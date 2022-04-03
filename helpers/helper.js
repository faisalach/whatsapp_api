const phoneNumberFormatter = (number) => {
    number  = number.replace(/[^0-9]/g,"");
    number  = number.replace(/^0/g,"62");
    number  = number+"@c.us";
    return number;
}

module.exports = {
    phoneNumberFormatter
}
