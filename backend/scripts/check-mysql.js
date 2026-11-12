const mysqlPool = require('../src/mysqlPool');

async function main() {
    const connected = await mysqlPool.ping();
    if (!connected) throw new Error('MySQL returned an unexpected health-check result.');
    console.log('MySQL connection is working. No portal records were changed.');
}

main()
    .catch(error => {
        console.error(`MySQL connection check failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => mysqlPool.close().catch(() => {}));
