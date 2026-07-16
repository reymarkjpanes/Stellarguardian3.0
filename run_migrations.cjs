const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

try { db.exec("ALTER TABLE events ADD COLUMN capacity INTEGER"); } catch (e) { console.log(e.message); }
try { db.exec("ALTER TABLE events ADD COLUMN teamSizeMax INTEGER DEFAULT 4"); } catch (e) { console.log(e.message); }
try { db.exec("ALTER TABLE events ADD COLUMN bannerUrl TEXT"); } catch (e) { console.log(e.message); }
try { db.exec("ALTER TABLE events ADD COLUMN contactEmail TEXT"); } catch (e) { console.log(e.message); }
console.log("Migrations applied");
