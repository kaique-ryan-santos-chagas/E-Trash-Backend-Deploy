const knex = require('knex');
const knexConfig = require('../../knexfile.js');

const connection = knex(knexConfig.production);

module.exports = connection;