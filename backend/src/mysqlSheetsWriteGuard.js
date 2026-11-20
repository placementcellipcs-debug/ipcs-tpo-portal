const mysqlEnabled = () => String(process.env.MYSQL_ENABLED || '').trim().toLowerCase() === 'true';

const WRITE_METHODS = new Set([
  'addRow', 'addRows', 'addSheet', 'addWorksheet', 'delete', 'deleteRows', 'deleteSheet',
  'clear', 'resize', 'setHeaderRow', 'save', 'saveUpdatedCells', 'updateProperties',
  'append', 'batchUpdate', 'batchClear', 'create', 'update',
]);
const proxyCache = new WeakMap();

const assertGoogleSheetsWriteAllowed = () => {
  if (!mysqlEnabled()) return;
  const error = new Error('Google Sheets writes are disabled while MySQL is the portal backend. This workflow needs its MySQL save path enabled.');
  error.code = 'MYSQL_SHEETS_WRITE_DISABLED';
  error.status = 503;
  throw error;
};

const wrapRow = row => wrapObject(row, {
  methods: new Set(['save', 'delete']),
  wrapRows: false,
});

const wrapWorksheet = worksheet => wrapObject(worksheet, {
  methods: new Set(['addRow', 'addRows', 'deleteRows', 'clear', 'resize', 'setHeaderRow', 'saveUpdatedCells', 'updateProperties']),
  wrapRows: true,
});

const wrapSpreadsheet = spreadsheet => wrapObject(spreadsheet, {
  methods: new Set(['addSheet', 'deleteSheet', 'saveInfo', 'saveProperties']),
  wrapRows: false,
});

const wrapObject = (object, options) => {
  if (!object || typeof object !== 'object') return object;
  if (proxyCache.has(object)) return proxyCache.get(object);
  const proxy = new Proxy(object, {
    get(target, property) {
      if (property === 'sheetsByTitle' && options.wrapRows === false) {
        const value = Reflect.get(target, property, target);
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).map(([title, sheet]) => [title, wrapWorksheet(sheet)]));
      }
      if (property === 'sheetsByIndex' && options.wrapRows === false) {
        const value = Reflect.get(target, property, target);
        return Array.isArray(value) ? value.map(wrapWorksheet) : value;
      }
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (options.methods.has(String(property))) {
        return (...args) => {
          assertGoogleSheetsWriteAllowed();
          return value.apply(target, args);
        };
      }
      if (options.wrapRows && property === 'getRows') {
        return (...args) => Promise.resolve(value.apply(target, args)).then(rows => (rows || []).map(wrapRow));
      }
      if (options.wrapRows && property === 'addRow') {
        return (...args) => {
          assertGoogleSheetsWriteAllowed();
          return Promise.resolve(value.apply(target, args)).then(wrapRow);
        };
      }
      if (options.wrapRows && property === 'addRows') {
        return (...args) => {
          assertGoogleSheetsWriteAllowed();
          return Promise.resolve(value.apply(target, args)).then(rows => (rows || []).map(wrapRow));
        };
      }
      return value.bind(target);
    },
  });
  proxyCache.set(object, proxy);
  return proxy;
};

const wrapGoogleApiResource = resource => {
  if (!resource || typeof resource !== 'object') return resource;
  if (proxyCache.has(resource)) return proxyCache.get(resource);
  const proxy = new Proxy(resource, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value === 'function') {
        if (WRITE_METHODS.has(String(property))) {
          return (...args) => {
            assertGoogleSheetsWriteAllowed();
            return value.apply(target, args);
          };
        }
        return value.bind(target);
      }
      return value && typeof value === 'object' ? wrapGoogleApiResource(value) : value;
    },
  });
  proxyCache.set(resource, proxy);
  return proxy;
};

const guardGoogleSheetsClient = client => wrapGoogleApiResource(client);

const guardGoogleSpreadsheet = spreadsheet => wrapSpreadsheet(spreadsheet);

module.exports = { assertGoogleSheetsWriteAllowed, guardGoogleSheetsClient, guardGoogleSpreadsheet };
