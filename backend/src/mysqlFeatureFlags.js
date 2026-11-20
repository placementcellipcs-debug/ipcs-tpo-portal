const mysqlEnabled = () => String(process.env.MYSQL_ENABLED || '').trim().toLowerCase() === 'true';

const isMysqlFeatureEnabled = flagName => mysqlEnabled()
  || String(process.env[flagName] || '').trim().toLowerCase() === 'true';

module.exports = { isMysqlFeatureEnabled, mysqlEnabled };
