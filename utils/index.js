const axios = require('axios');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

exports.apiTicket = (verb, params, cb = null) => {
    axios.post(config.apiHost + verb + 'ticket', params)
    .then(async (res) => {
        console.log('import ticket', res.data);
        if (cb) cb(res.data);
    })
    .catch(err => {
        console.log('api failed', err);
    });
}

function replaceKeywords(str, keys) {
    const fIndex = str.indexOf('{');
    const lIndex = str.indexOf('}', fIndex) || str.length - 1;
    if (fIndex >= 0) {
        const key = str.substr(fIndex + 1, lIndex - fIndex - 1);
        if (keys[key]) {
            str = str.substr(0, fIndex) + keys[key] + str.substr(lIndex + 1);
            return replaceKeywords(str, keys);
        }
    } else {
        return str;
    }
}
exports.replaceKeywords = replaceKeywords;