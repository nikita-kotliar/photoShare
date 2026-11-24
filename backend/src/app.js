const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
morgan.token('safe-url', (req) => {
  const url = req.originalUrl || req.url;
  return url.includes('/auth/google/callback') ? url.split('?')[0] : url;
});
const LOG_FORMAT =
  ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';
if (!env.isTest) app.use(morgan(env.isProduction ? LOG_FORMAT : 'dev'));

app.use('/api', routes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
