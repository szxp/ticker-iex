
let args = process.argv.slice(2);
let cmd = args[0]
let webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until,
    Key = webdriver.Key;

const gmailId = 'iexclo05'; 
const gmailPassword = 'iex!cloud123';


async function main() {
    let gmail = new Gmail(gmailId, gmailPassword);
    let iexCloud = new IEXCloud();

    switch (cmd) {
        case 'account':
            let ticker = normTicker(args[1]);
            let acc = new Account(ticker);
            console.log(acc.toString());
            break;

        case 'create-account':
            for (let i = 1; i < args.length; i++) {
                let ticker = normTicker(args[i]);
                let acc = new Account(ticker);
                await iexCloud.register(acc);
            }
            await iexCloud.close();
            break;

        case 'token':
            await gmail.login();

            for (let i = 1; i < args.length; i++) {
                let ticker = normTicker(args[i]);
                let acc = new Account(ticker);
                let loginTime = await iexCloud.login(acc);
                let code = await gmail.getIEXVerificationCode(email, loginTime);
                await iexCloud.verifyLogin(code);
                let token = await iexCloud.token();
                console.log(ticker+','+token);
            }
            await gmail.close();
            await iexCloud.close();
            break;

        default:
            console.log('unknown command: ' + cmd);
            process.exit(1);
    }
}

function newBrowser(name) {
    return new webdriver.Builder().forBrowser(name).build();
}


async function findAgreeBtn(driver) {
    let buttons = await driver.findElements(By.css('button'))
        .then(function (els) {
            return els;
        })
        .then(null, function (err) {
            return [];
        });

    for (let i = 0; i < buttons.length; i++) {
        let btn = buttons[i];
        let text = await btn.getText();
        if (text.includes('AGREE')) {
            return btn;
        }
    }
    return null;
}

async function verifyEmailMailpoof(driver, acc) {
    let emailPrefix = acc.email.split('@')[0];
    await driver.get('https://mailpoof.com/mailbox/' + acc.email);

    let emailLinkLabel = 'IEX Cloud Email Verification';

    
    await driver.wait(async function () {
        let btn = findAgreeBtn(driver);
        return !!btn;
    }, 60000);

    let agreeBtn = await findAgreeBtn(driver);
    await agreeBtn.click();

    let subject = 'IEX Cloud Email Verification';
    let mailItem;
    await driver.wait(async function () {
        let mailItems = await driver.findElements(By.css('.mail-item'))
            .then(function (els) {
                return els;
            })
            .then(null, function (err) {
                return [];
            });

        for (let i = 0; i < mailItems.length; i++) {
            let item = mailItems[i];
            let text = await item.getText();
            if (text.includes(subject)) {
                mailItem = item;
                return true;
            }
        }
        return false;
    }, 60000);

    await mailItem.click();


    let emailText;
    await driver.wait(async function () {
        let mailContents = await driver.findElements(By.css('.mail-content'))
            .then(function (els) {
                return els;
            })
            .then(null, function (err) {
                return [];
            });

        for (let i = 0; i < mailContents.length; i++) {
            let mailContent = mailContents[i];
            let text = await mailContent.getText();
            if (text.includes('https://iexcloud.io/console/email-verify/')) {
                emailText = text;
                return true;
            }
        }
        return false;
    }, 60000);


    let verifLinkRE = /(https:\/\/.+)$/g;
    let match = verifLinkRE.exec(emailText);
    let verifHref = match[0].trim();

    //console.log(verifHref);
    await driver.get(verifHref);
}





function Gmail(id, password){
    this.id = id;
    this.password = password;

    // 0: not logged in
    // 1: in progress
    // 2: successfully logged in
    this.loginStatus = 0;
}


Gmail.prototype.login = async function(){
    if (this.loginStatus !== 0) {
        return;
    }
    this.loginStatus = 1;

    if (!this.driver) {
        this.driver = newBrowser('firefox');
    }

    let driver = this.driver;

    await driver.get('https://accounts.google.com/signin/v2/identifier?continue=https%3A%2F%2Fmail.google.com%2Fmail%2F&service=mail&sacu=1&rip=1&flowName=GlifWebSignIn&flowEntry=ServiceLogin');

    let inputId = await driver.wait(
        until.elementLocated(By.id('identifierId')), 10000);

    await inputId.sendKeys(this.id);
    await driver.findElement(By.id('identifierNext')).click();
    
    await driver.sleep(3000);
    let inputPwd = await driver.wait(
        until.elementLocated(By.css('input[type="password"]')), 10000);
    await inputPwd.sendKeys(this.password);
    await driver.findElement(By.id('passwordNext')).click();
    
    await driver.sleep(5000);
    
    await driver.wait(
        until.elementLocated(By.css('input[name="q"]')), 10000);

    this.loginStatus = 2;
};

Gmail.prototype.getIEXVerificationCode = async function(email, loginTime){
    let driver = this.driver;
    return new Promise(async function(resolve, reject) {

        while (true) {
            await driver.wait(
                until.elementLocated(By.css('input[name="q"]')), 10000);
            
            //console.log('wait for q');
            await driver.sleep(3000);

            let inputQ = await driver.wait(
                until.elementLocated(By.css('input[name="q"]')), 10000);
            await inputQ.click();
            await inputQ.clear();
            await inputQ.sendKeys(
                "to:("+email+")", Key.ENTER);


            //console.log('wait for search results');
            await driver.sleep(2000);

            let rows = await driver.findElements(
                 By.css('div[role="main"] table[role="grid"] tr[role="row"]'))
                .then(function (els) {
                    return els;
                })
                .then(null, function (err) {
                    return [];
                });
    
                for (let i = 0; i < rows.length; i++) {
                    let row = rows[i];
                    let text = await row.getText();
                    if (text.includes("verification code:")) {
                        let timeRE = /This message was generated on (.*EDT)/g;
                        let match = timeRE.exec(text);
                        let msgTime = Date.parse(match[1].trim());

                        if ( ((loginTime - 60_000) < msgTime) && (msgTime < (loginTime + 60000))) {
                            let codeRE = /verification code: ([0-9]+)/g;
                            let match = codeRE.exec(text);
                            let code = match[1].trim();
                            resolve(code);
                            //reject(why);
                            return;
                        }
                    }
                }
        }

    });
};

Gmail.prototype.close = async function(){
    this.driver.close();
};

function IEXCloud(password){
}


IEXCloud.prototype.login = async function(acc){
    if (!this.driver) {
        this.driver = newBrowser('firefox');
    }
    let driver = this.driver;

    await driver.get('https://iexcloud.io/cloud-login');

    let inputEmail = await driver.wait(
        until.elementLocated(By.id('email')), 10000);
    await inputEmail.sendKeys(acc.email);

    let inputPwd = await driver.wait(
        until.elementLocated(By.css('input[type="password"]')), 10000);
    await inputPwd.sendKeys(acc.password);

    let loginTime = new Date().getTime();
    await driver.findElement(By.id('loginSubmit')).click();
    
    await driver.wait(
        until.elementLocated(By.id('code0')), 60000);

    return loginTime;
};

IEXCloud.prototype.verifyLogin = async function(code){
    let driver = this.driver;
    
    await driver.wait(
        until.elementLocated(By.id('code0')), 10000);
    
    await driver.findElement(By.id('code0')).sendKeys(code.charAt(0));
    await driver.findElement(By.id('code1')).sendKeys(code.charAt(1));
    await driver.findElement(By.id('code2')).sendKeys(code.charAt(2));
    await driver.findElement(By.id('code3')).sendKeys(code.charAt(3));
    await driver.findElement(By.id('code4')).sendKeys(code.charAt(4));
    await driver.findElement(By.id('code5')).sendKeys(code.charAt(5));
    
    await driver.wait(
        until.elementLocated(By.css('a[href="/console/tokens"]')), 60000);
};

IEXCloud.prototype.token = async function(){
    let driver = this.driver;
   
    let homeUrl = 'https://iexcloud.io/console';
    let currUrl = await driver.getCurrentUrl();
    
    if (currUrl !== homeUrl) {
        await driver.get('https://iexcloud.io/console');
    }

    return await driver.wait(until.elementLocated(
        By.css('.api-token-text')), 10000).getText();
};

IEXCloud.prototype.register = async function(acc) {
    if (!this.driver) {
        this.driver = newBrowser('firefox');
    }
    let driver = this.driver;

    await driver.get('https://iexcloud.io/cloud-login#/register');

    await driver.wait(
        until.elementLocated(By.css('form')), 10000);

    await driver.findElement(By.css("option[value='individual']")).click()
    await driver.findElement(By.id('companyName')).sendKeys(acc.name);
    await driver.findElement(By.id('email')).sendKeys(acc.email);
    await driver.findElement(By.id('password')).sendKeys(acc.password);
    await driver.findElement(By.css('.showCheckBox')).click();

    await driver.sleep(3000);

    let submitBtn = driver.findElement(By.css('button[type="submit"]'));
    await submitBtn.click();

    await driver.wait(
        until.elementLocated(By.id('setup')), 60000);


    let buttons = await driver.findElements(By.css('button'));
    for (let i = 0; i < buttons.length; i++) {
        let btn = buttons[i];
        let label = await btn.getText();
        if (label === "Select Start plan") {
            btn.click();
        }
    };

    await driver.wait(
        until.elementLocated(By.css('a[href="/console/tokens"]')), 60000);

    console.log(acc.ticker);
    // wait for 30+-some random minutes
    let rand = Math.floor(Math.random() * 5);
    await driver.sleep((30 + rand) * 60 * 1000);
};

IEXCloud.prototype.close = async function(){
    this.driver.close();
};

function Account(ticker) {
    let code = hashcode(ticker);
    this.name = ticker;
    this.email = "iexclo05+" + ticker.toLowerCase() + "@gmail.com";
   // this.name = name(code);
   // this.email = email(this.name, code);
    this.password = 'iexcloud!123';
    this.ticker = ticker;
}

Account.prototype.toString = function () {
    return this.ticker + ' ' +
        this.email + ' ' +
        this.password + ' ' +
        this.name;
};

function normTicker(s) {
    return s.trim().toUpperCase();
}

function hashcode(s) {
    let hash = 0, i, chr;
    if (s.length === 0) {
        return hash;
    }
    for (i = 0; i < s.length; i++) {
        chr = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};



function email(name, code) {
    let email = name.trim();
    email = email.replace(/[^a-zA-Z0-9]/g, ' ');
    email = email.replace(/\s+/g, '.');
    email = email.toLowerCase();
    email = email.trim();
    email += '.' + code + '@mailpoof.com';
    return email;
}


main();

