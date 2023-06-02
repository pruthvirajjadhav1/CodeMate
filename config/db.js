const mongoose = require("mongoose");

const connectWithDb = () => {
  mongoose
    .connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(console.log(`CONNECTED TO DB`))
    .catch((error) => {
      console.log(`DB NOT COONECTED`);
      console.log(error);
      process.exit(1);
    });
};

module.exports = connectWithDb;
