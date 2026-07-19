const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env')
});

const express = require('express');
const sequelize = require('./db');

const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');


// ROUTES
const localAuthRoutes = require('./routes/localAuth');
const productRoutes = require('./routes/products');
const clientRoutes = require('./routes/clients');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const backupRoutes = require("./routes/backups");
const printerRoutes = require(
  "./routes/printer"
);
const {
  createBackup,
} = require("./services/backupService");
require("./models");

// LOCAL MODELNI YUKLASH
require('./models/localUser');

const app = express();

const PORT = process.env.PORT || 3008;

app.use(express.json());

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

// LOCAL CRM ROUTES
app.use('/crm', localAuthRoutes);
app.use('/crm', productRoutes);
app.use('/crm', clientRoutes);
app.use('/crm', orderRoutes);
app.use('/crm', paymentRoutes);
app.use('/crm', backupRoutes);
app.use("/crm", printerRoutes);
// ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error',
  });
});

async function start() {
  try {
    await sequelize.authenticate();

    await sequelize.sync({
      alter: true,
    });

    console.log(
      'Database connected successfully'
    );
   await createBackup();
    app.listen(PORT, () => {
      console.log(
        `Server is running on port ${PORT}`
      );
    });

  } catch (error) {
    console.error(
      'Unable to connect to the database:',
      error
    );
  }
}

start();