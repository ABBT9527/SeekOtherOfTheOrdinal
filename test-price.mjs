import Decimal from 'break_eternity.js';

const pv = Decimal.pow(3, 6).round();
console.log('pv =', pv.toString());
console.log('pv.mul(2) =', pv.mul(2).toString());
console.log('pv.mul(2).eq(1458) =', pv.mul(2).eq(1458));
