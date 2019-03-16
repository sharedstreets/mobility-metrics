const path = require("path");
const through2 = require("through2");
const level = require("level");

level(path.join(__dirname, "../data"))
  .createReadStream()
  .pipe(
    through2.obj((item, enc, next) => {
      console.log(item.key);
      console.log("  " + item.value);
      next();
    })
  );
