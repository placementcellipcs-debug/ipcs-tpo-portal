const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const CONFIG = {
  aptitude: { tab: 'Aptitude_Questions', resultTab: 'Aptitude_Results' },
  talentino: { tab: 'Talentino_Questions', resultTab: 'Talentino_Results' },
};

const text = value => String(value ?? '');
const clean = value => text(value).trim();
const parseCells = value => {
  if (Array.isArray(value)) return [...value];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

const projectQuestion = (type, cells) => type === 'aptitude'
  ? ({ id: clean(cells[0]), category: text(cells[1]), question: text(cells[2]), optA: text(cells[3]), optB: text(cells[4]), optC: text(cells[5]), optD: text(cells[6]), correct: text(cells[7]), explanation: text(cells[8]), status: text(cells[9]) || 'Active', level: text(cells[10]) || 'Easy' })
  : ({ id: clean(cells[0]), testNumber: text(cells[1]), question: text(cells[2]), optA: text(cells[3]), optB: text(cells[4]), optC: text(cells[5]), optD: text(cells[6]), correct: text(cells[7]), explanation: text(cells[8]), status: text(cells[9]) || 'Active' });

const projectResult = (type, cells) => type === 'aptitude'
  ? ({ timestamp: text(cells[0]), rollNo: text(cells[1]), name: text(cells[2]), email: text(cells[3]), branch: text(cells[4]), score: text(cells[5]), total: text(cells[6]), percentage: text(cells[7]), timeTaken: text(cells[8]), categoryBreakdown: text(cells[9]) })
  : ({ timestamp: text(cells[0]), rollNo: text(cells[1]), name: text(cells[2]), email: text(cells[3]), branch: text(cells[4]), testNumber: text(cells[5]), score: text(cells[6]), total: text(cells[7]), percentage: text(cells[8]), timeTaken: text(cells[9]) });

async function listQuestions(type) {
  const config = CONFIG[type];
  if (!config) throw new Error('Unsupported assessment type.');
  const [rows] = await mysqlPool.query(
    `SELECT source_cells_json FROM assessment_records
     WHERE record_type = 'question' AND assessment_type = ? AND source_tab = ?
     ORDER BY source_row_number IS NULL, source_row_number, created_at, id`,
    [type, config.tab],
  );
  return rows.map(row => projectQuestion(type, parseCells(row.source_cells_json))).reverse();
}

async function listResults(type, actor, canSeeAll, userHasBranch) {
  const config = CONFIG[type];
  if (!config) throw new Error('Unsupported assessment type.');
  const [rows] = await mysqlPool.query(
    `SELECT source_cells_json FROM assessment_records
     WHERE record_type = 'result' AND assessment_type = ? AND source_tab = ?
     ORDER BY source_row_number IS NULL, source_row_number, created_at, id`,
    [type, config.resultTab],
  );
  return rows.map(row => projectResult(type, parseCells(row.source_cells_json)))
    .filter(result => canSeeAll(actor) || userHasBranch(actor, result.branch)).reverse();
}

function fieldsToCells(type, input, current = []) {
  const cells = [...current];
  const valueMap = type === 'aptitude'
    ? [[0, input.id], [1, input.category], [2, input.question], [3, input.optA], [4, input.optB], [5, input.optC], [6, input.optD], [7, input.correct], [8, input.explanation], [9, input.status || 'Active'], [10, input.level || 'Medium']]
    : [[0, input.id], [1, input.testNumber], [2, input.question], [3, input.optA], [4, input.optB], [5, input.optC], [6, input.optD], [7, input.correct], [8, input.explanation], [9, input.status || 'Active']];
  for (const [index, value] of valueMap) if (value !== undefined) cells[index] = text(value);
  return cells;
}

async function audit(connection, actor, action, entityId, details) {
  const email = clean(actor?.email || actor?.loginEmail).toLowerCase();
  const [[user]] = email ? await connection.execute(
    'SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [email],
  ) : [[null]];
  await connection.execute(
    `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, details)
     VALUES (?, ?, ?, 'assessment_question', ?, UTC_TIMESTAMP(), ?)`,
    [crypto.randomUUID(), user?.id || null, action, entityId || null, JSON.stringify(details || {})],
  );
}

async function saveQuestion(type, input, actor, action) {
  const config = CONFIG[type];
  if (!config) throw new Error('Unsupported assessment type.');
  const questionId = clean(input.id);
  if (!questionId) throw new Error('A question ID is required.');
  return mysqlPool.withTransaction(async connection => {
    const [matches] = await connection.execute(
      `SELECT id, source_cells_json FROM assessment_records
       WHERE record_type = 'question' AND assessment_type = ? AND source_tab = ? AND question_id = ?
       ORDER BY source_row_number, created_at, id`, [type, config.tab, questionId],
    );
    if (action === 'add' && matches.length) throw new Error('Question ID already exists.');
    if (action !== 'add' && matches.length !== 1) throw new Error(matches.length ? 'Question ID is duplicated and needs review.' : 'Question ID not found.');
    if (action === 'delete') {
      await connection.execute('DELETE FROM assessment_records WHERE id = ?', [matches[0].id]);
      await audit(connection, actor, 'assessment_question_deleted', matches[0].id, {
        type, questionId, previousCells: parseCells(matches[0].source_cells_json),
      });
      return { changed: true };
    }
    const previous = action === 'update' ? parseCells(matches[0].source_cells_json) : [];
    const cells = fieldsToCells(type, input, previous);
    const projection = type === 'aptitude'
      ? { group: clean(cells[1]) || null, category: clean(cells[1]) || null, question: text(cells[2]) || null, a: text(cells[3]) || null, b: text(cells[4]) || null, c: text(cells[5]) || null, d: text(cells[6]) || null, answer: text(cells[7]) || null, explanation: text(cells[8]) || null, status: clean(cells[9]) || null, level: clean(cells[10]) || null }
      : { group: clean(cells[1]) || null, category: null, question: text(cells[2]) || null, a: text(cells[3]) || null, b: text(cells[4]) || null, c: text(cells[5]) || null, d: text(cells[6]) || null, answer: text(cells[7]) || null, explanation: text(cells[8]) || null, status: clean(cells[9]) || null, level: null };
    if (action === 'add') {
      const id = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO assessment_records
         (id, source_record_key, source_key, source_tab, assessment_type, record_type, assessment_group,
          question_id, category, question_text, option_a, option_b, option_c, option_d, answer_text,
          explanation, status_text, level_text, source_cells_json)
         VALUES (?, ?, 'mysql_runtime', ?, ?, 'question', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, `runtime:${id}`, config.tab, type, projection.group, questionId, projection.category,
          projection.question, projection.a, projection.b, projection.c, projection.d, projection.answer,
          projection.explanation, projection.status, projection.level, JSON.stringify(cells)],
      );
      await audit(connection, actor, 'assessment_question_created', id, { type, questionId, newCells: cells });
      return { changed: true, id };
    }
    await connection.execute(
      `UPDATE assessment_records SET question_id = ?, assessment_group = ?, category = ?, question_text = ?, option_a = ?,
       option_b = ?, option_c = ?, option_d = ?, answer_text = ?, explanation = ?, status_text = ?,
       level_text = ?, source_cells_json = ? WHERE id = ?`,
      [questionId, projection.group, projection.category, projection.question, projection.a, projection.b, projection.c,
        projection.d, projection.answer, projection.explanation, projection.status, projection.level,
        JSON.stringify(cells), matches[0].id],
    );
    await audit(connection, actor, 'assessment_question_updated', matches[0].id, {
      type, questionId, previousCells: previous, newCells: cells,
    });
    return { changed: true, id: matches[0].id };
  });
}

module.exports = { listQuestions, listResults, saveQuestion };
