const model = {};
model.log = (str) => {
    console.log(str);
};

model.logError = (str) => {
    console.error(str);
};

model.exit = () => {
    throw new Error('exit');
};

model.arrayChunk = (arr, num) => {
    let c = arr.length / num;
    if (arr.length % num > 0) {
        c++;
    }
    const result = [];
    for (let i = 0; i < c; i++) {
        const a = arr.splice(0, num);
        if (a.length > 0) {
            result.push(a);
        }
    }
    return result;
};

module.exports = model;
