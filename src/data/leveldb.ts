var levelup = require("levelup");
var leveldown = require("leveldown");

export class LevelDB {
  db;

  constructor(directory) {
    this.db = levelup(leveldown(directory));
  }

  async get(key: string): Promise<any> {
    try {
      var data = await this.db.get(key);
      return data.toString();
    } catch (error) {
      return null;
    }
  }

  async put(key: string, data: any) {
    return await this.db.put(key, data);
  }

  async has(key: string): Promise<boolean> {
    try {
      await this.db.get(key);
      return true;
    } catch (error) {
      return null;
    }
  }
}
