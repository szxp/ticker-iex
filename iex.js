
let args = process.argv.slice(2);
let cmd = args[0]
let ticker, acc;
let webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until,
    Key = webdriver.Key;

const gmailId = 'iexclo05'; 
const gmailPassword = 'iex!cloud123';
let gmail;

const iexPassword = 'iexcloud!123';
let iexCloud;

async function main() {
    switch (cmd) {
        case 'account':
            ticker = normTicker(args[1]);
            acc = new Account(ticker);
            console.log(acc.toString());
            break;

        case 'create-account':
            ticker = normTicker(args[1]);
            acc = new Account(ticker);
            createAccount(acc);
            break;

        case 'token':
            initGmail();
            await gmail.login();
            initIEXCloud();

            for (let i = 1; i < args.length; i++) {
                let ticker = normTicker(args[i]);
                let email = 'iexclo05+'+ticker.toLowerCase()+'@gmail.com';
                let loginTime = await iexCloud.login(email);
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

function initGmail() {
    if (!gmail) {
        gmail = new Gmail(gmailId, gmailPassword);
    }
}

function initIEXCloud() {
    if (!iexCloud) {
        iexCloud = new IEXCloud(iexPassword);
    }
}

async function createAccount(acc) {
    let driver = newBrowser('firefox');
    await register(driver, acc);
    //await verifyEmailMailpoof(driver, acc);
    //await token(driver, acc);
    driver.close();
}

function newBrowser(name) {
    return new webdriver.Builder().forBrowser(name).build();
}

async function register(driver, acc) {
    await driver.get('https://iexcloud.io/cloud-login#/register');

    await driver.wait(
        until.elementLocated(By.css('form')), 10000);

    await driver.findElement(By.css("option[value='individual']")).click()
    await driver.findElement(By.id('companyName')).sendKeys(acc.name);
    await driver.findElement(By.id('email')).sendKeys(acc.email);
    await driver.findElement(By.id('password')).sendKeys(acc.pwd);
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
    this.password = password;
}


IEXCloud.prototype.login = async function(email){
    if (!this.driver) {
        this.driver = newBrowser('firefox');
    }
    let driver = this.driver;

    await driver.get('https://iexcloud.io/cloud-login');

    let inputEmail = await driver.wait(
        until.elementLocated(By.id('email')), 10000);
    await inputEmail.sendKeys(email);

    let inputPwd = await driver.wait(
        until.elementLocated(By.css('input[type="password"]')), 10000);
    await inputPwd.sendKeys(this.password);

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
}

IEXCloud.prototype.token = async function(){
    let driver = this.driver;
   
    let homeUrl = 'https://iexcloud.io/console';
    let currUrl = await driver.getCurrentUrl();
    
    if (currUrl !== homeUrl) {
        await driver.get('https://iexcloud.io/console');
    }

    return await driver.wait(until.elementLocated(
        By.css('.api-token-text')), 10000).getText();
}

IEXCloud.prototype.close = async function(){
    this.driver.close();
};

function Account(ticker) {
    let code = hashcode(ticker);
    this.name = ticker;
    this.email = "iexclo05+" + ticker.toLowerCase() + "@gmail.com";
   // this.name = name(code);
   // this.email = email(this.name, code);
    this.pwd = 'iexcloud!123';
    this.ticker = ticker;
}

Account.prototype.toString = function () {
    return this.ticker + ' ' +
        this.email + ' ' +
        this.pwd + ' ' +
        this.name;
}

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


let names = [
    "Demetria Pering",
    "Shae Sirey",
    "Olly Burwood",
    "Jolee Methingam",
    "Josefina Zupone",
    "Immanuel Gilbeart",
    "Penny Heindl",
    "Daffie Kneel",
    "Kora Barclay",
    "Bale Hamsley",
    "Maxie Henkmann",
    "Florella Grace",
    "Alaric Nutley",
    "Kasper Woollard",
    "Meghann Dunseath",
    "Alix Rainey",
    "Robyn Whitebrook",
    "Donielle Kebbell",
    "Becca Risby",
    "Leontine Gummary",
    "Dermot McKennan",
    "Carey Ibbott",
    "Osbert Vayne",
    "Ebba Tune",
    "Gerek Stollenberg",
    "Jobi Ligertwood",
    "Briano Craske",
    "Lanie Madrell",
    "Wake Kynston",
    "Polly Kenwright",
    "Donica MacDonell",
    "Renault Merchant",
    "Darn Donaghy",
    "Den Oselton",
    "Putnam Frankum",
    "Allin Mowsley",
    "Lorrayne Hadlow",
    "Nickey Carcas",
    "Issy Boote",
    "Marti Clutton",
    "Luke Gillino",
    "Anne Legat",
    "Engracia Grastye",
    "Chelsae Boater",
    "Leicester Patching",
    "Lukas Macieja",
    "Demetrius Beall",
    "Cary Blanchflower",
    "Casper Tzarkov",
    "Gretta Espinal",
    "Wilona Cicconettii",
    "Derrick Shoulders",
    "Kimmi Searson",
    "Zolly Gillan",
    "Thoma Coldbathe",
    "Odessa Stummeyer",
    "Garnette Trudgian",
    "Kare Tschierse",
    "Thaxter Coatman",
    "Aggie Daingerfield",
    "Lemuel Dami",
    "Shell Babb",
    "Auroora Rama",
    "Lazaro Kelley",
    "Cindi Shakeshaft",
    "Pearl Pringer",
    "Raine Deeley",
    "Roda Levene",
    "My Niesel",
    "Joshua Geharke",
    "Darby Bainbrigge",
    "Filia Truman",
    "Isabelle Lannon",
    "Hastings Dhennin",
    "Vasily Meltetal",
    "Malinde Onians",
    "Rinaldo Paunton",
    "Lena Legat",
    "Nedi Barbey",
    "Rabi Down",
    "Geraldine Bernardoux",
    "Nelly Edmeades",
    "Sheree Tatlock",
    "Noble Lilleman",
    "Marleen Haggerwood",
    "Dosi Yokley",
    "Aylmer Marshalleck",
    "Franky Bernardet",
    "Aubrette Rewbottom",
    "Ferrel Emma",
    "Lucinda McGiffie",
    "Marabel Filmer",
    "Aimee Easterbrook",
    "Gusti Fryett",
    "Kellby Isacsson",
    "Dredi Sackett",
    "Welch Formoy",
    "Boigie Angus",
    "Marcy Ancliffe",
    "Nichol Lethieulier",
    "Arty Rickarsey",
    "Reyna Robotham",
    "Shauna Portail",
    "Dorene Whittek",
    "Shay Hebard",
    "Grier Radolf",
    "Dalton Gateley",
    "Rita Tolliday",
    "Alic Disney",
    "Steward Ambrogelli",
    "Carmella Rapper",
    "Edouard Parnaby",
    "Antoine Krause",
    "Mei Giraudot",
    "Bevon Talkington",
    "Harry Katz",
    "Lenci Murricanes",
    "Rhianna Tresler",
    "Loni Akrigg",
    "Giana Colten",
    "Yardley Ludman",
    "Alfy Welbourn",
    "Glenn Wapple",
    "Roma Lock",
    "Lurleen Tamblingson",
    "Freemon Cotterell",
    "Clare Adami",
    "Howard Isenor",
    "Marga Jeckells",
    "Claiborne Matyushenko",
    "Catha Donoghue",
    "Dode Lawlee",
    "Nanete Esberger",
    "Napoleon Coogan",
    "Kathleen MacNally",
    "Anabelle Alonso",
    "Rosamund Corbet",
    "Hannah Haitlie",
    "Prisca Ayllett",
    "Alejandra Gornal",
    "Travus Southan",
    "Allen Laurenceau",
    "Ingeberg Drescher",
    "Baxy Engeham",
    "Roxana Soan",
    "Nikki Kennford",
    "Euphemia Caunce",
    "Hanan Boothe",
    "Faye Woodburne",
    "Towny Scamaden",
    "Archambault Knotton",
    "Flem Arzu",
    "Rikki Merrgan",
    "Donelle Durnford",
    "Essa Haire",
    "Gregoor Biaggelli",
    "Henri Croxon",
    "Alicea Espinola",
    "Melina Adnams",
    "Bob Ruegg",
    "Row Sargood",
    "Sanderson Patters",
    "Dorolice Kytley",
    "Cesar Croson",
    "Selle Champken",
    "Caesar Neligan",
    "Reggie Markey",
    "Briny Tacker",
    "Delly Skirling",
    "Anabal Crewdson",
    "Donalt Withey",
    "Bryn Boise",
    "Maje Baldack",
    "Cale Maffione",
    "Eydie Figge",
    "Louisa Birdwhistell",
    "Issie Balogun",
    "Miles Rastrick",
    "Jordain Pietri",
    "Delora Risley",
    "Eddy Kasher",
    "Orin Else",
    "Charles Scurrey",
    "Jarrod MacMenemy",
    "Kiri Sayton",
    "Belvia Sainsbury-Brown",
    "Arabela Edeson",
    "Gus Scarlet",
    "Thadeus Ahrens",
    "Stephie Alfonso",
    "Rosalinda Fiddy",
    "Lucilia Columbine",
    "Laureen Mossman",
    "Estrella Stelli",
    "Emera Treneer",
    "See Le Floch",
    "Angelita Tresler",
    "Darelle Salack",
    "Korella Scholl",
    "Friedrich Adelsberg",
    "Kristo Abson",
    "Brandi Fromant",
    "Lynelle Lampel",
    "Barn Town",
    "Fraser Maple",
    "Germain Mudge",
    "Ronny Darben",
    "Rhys Joutapavicius",
    "Salomone Prisk",
    "Denyse Zecchetti",
    "Malinde Twomey",
    "Lisa Seine",
    "Cloris Capel",
    "Lynea Forst",
    "Gilly Thornton",
    "Sydney Charer",
    "Shaylyn Foffano",
    "Danya Burtenshaw",
    "Myrna Coldbath",
    "Bern Longhurst",
    "Mandie O' Mullane",
    "Cami Woonton",
    "Beniamino Pinckstone",
    "Chris Idle",
    "Drona Dollin",
    "Tatum Bernardelli",
    "Pete Bedbury",
    "Cacilia Harrowell",
    "Prent Rosberg",
    "Eldon Renak",
    "Tildy Trembath",
    "Joseph Lorman",
    "Gisele Messier",
    "Myles Helliar",
    "Tommy Ballingal",
    "Antonio Smitten",
    "Wheeler Coot",
    "Madelle Hairesnape",
    "Chickie Twist",
    "Melodee Cosgrive",
    "Dina Larmet",
    "Waneta Makeswell",
    "Brandon Dummigan",
    "Roddie Imlin",
    "Yank Hutchin",
    "Dulcinea Carling",
    "Cordelie Gillbee",
    "Tiebout Lau",
    "Hedy Camillo",
    "La verne Semor",
    "Shirlene Feye",
    "Christal Labrone",
    "Talyah Iddens",
    "Anabelle Helkin",
    "Katleen Cranidge",
    "Wilow Bebbell",
    "Lexis Boik",
    "Winnifred Martina",
    "Cchaddie Bury",
    "Winston Steiner",
    "Portia Scannell",
    "Cesar Harry",
    "Amalee Joutapaitis",
    "Lilla De Goey",
    "Josey Nuccii",
    "Nefen Northill",
    "Melba McNickle",
    "Tori Holtom",
    "Jud Buttner",
    "Linnie Verdey",
    "Viviyan Guite",
    "Courtnay Dunan",
    "Chrystel Mathan",
    "Frazier Musgrave",
    "Chad Mitton",
    "Kinsley Orcott",
    "Frederik Leggan",
    "Ester Abeles",
    "Marijo Bellow",
    "Ivette Day",
    "Averell Cosgriff",
    "Axe Hambribe",
    "Rosemaria O'Driscole",
    "Estele Critchley",
    "Mauricio Doone",
    "Marybelle Ivashechkin",
    "Tania Dockrill",
    "Bernard Ilyin",
    "Otho Maplestone",
    "Gabie Sinisbury",
    "Fabian Barnewille",
    "Garwood Temple",
    "Ced Refford",
    "Jacquenetta Chastey",
    "Ross Maghull",
    "Helaine Allworthy",
    "Frankie Nore",
    "Ardys Pyke",
    "Fiona Greve",
    "Dana Hazelden",
    "Kyrstin Craddock",
    "Shamus Muckley",
    "Cathie Bointon",
    "Breanne Dockrill",
    "Inge Noe",
    "Rolf Hinksen",
    "Alleen Kensitt",
    "Ellette Astill",
    "Melessa Brussels",
    "Olly Ditty",
    "Marcelo Millgate",
    "Remy Antrag",
    "Sawyer Bronot",
    "Cherlyn Lummus",
    "Gretna Rooze",
    "Leonora McConville",
    "Shaun Williamson",
    "Dicky Efford",
    "Thorndike Gallier",
    "Misty Thew",
    "Adlai Gales",
    "Margaux Rossey",
    "Rose Ebbotts",
    "Hermia Cumberpatch",
    "Theresina Melan",
    "Theresa Slate",
    "Andros Iacovaccio",
    "Aguistin Steaning",
    "Fleurette Gilhooly",
    "Barbi Govett",
    "Barris Denning",
    "Koo Spreag",
    "Darell Deards",
    "Christal Goutcher",
    "Roze Banane",
    "Joscelin Fillary",
    "Westbrooke Bugs",
    "Cherie Austin",
    "Aurore Coughtrey",
    "Loy Kinkade",
    "Alonzo Messiter",
    "Kriste Elliss",
    "Kelbee Acors",
    "Patric Izakov",
    "Vere Balas",
    "Georgia Riddlesden",
    "Roderick Meineking",
    "Binny Latham",
    "Shaina Fitzgerald",
    "Leora Woodbridge",
    "Payton Murfin",
    "Wilbert Phizackarley",
    "Ardys Sautter",
    "Dulciana McCullum",
    "Aarika Houlson",
    "Grier Reeveley",
    "Donall Canelas",
    "Ange Novik",
    "Alistair Stocking",
    "Minerva Tolwood",
    "Sven Escalero",
    "Ceciley Rubinovitsch",
    "Gretel Sciacovelli",
    "Onofredo Firpi",
    "Chas Faloon",
    "Christin Barrs",
    "Dorey Cluckie",
    "Faye Swigger",
    "Carissa Simester",
    "Jecho Worboy",
    "Noellyn Brideau",
    "Julius Beadell",
    "Cilka Di Antonio",
    "Lindy Lamble",
    "Winfield Moulds",
    "Luke Klambt",
    "Kienan Courteney",
    "Therine McCunn",
    "Anett Joska",
    "Bailey Lapthorn",
    "Iver Baudet",
    "Chet Rosendahl",
    "Lin Le Franc",
    "Obadiah Lintot",
    "Helen Tulloch",
    "Ruthann Leiden",
    "Locke Moloney",
    "Salomo Oaker",
    "Davy Turton",
    "Darsey Cowie",
    "Peggy Gallant",
    "Jdavie Howgill",
    "Gunilla Ferne",
    "Karyn Sciusscietto",
    "Anette Jaher",
    "Dre Iglesias",
    "Shirlene Jehan",
    "Kimberlyn Jales",
    "Pegeen Doggrell",
    "Angus Kibble",
    "Linoel Sprigin",
    "Webster Sicely",
    "Daryl Gatrell",
    "Lonnie Sier",
    "Aubrette Golland",
    "Desirae Weins",
    "Irvine Halfacre",
    "Dianne Jacquet",
    "Roxie Gladebeck",
    "Kerwinn Millthorpe",
    "Fenelia Barnfather",
    "Mikaela Callingham",
    "Staford Jellico",
    "Feodor Cornbill",
    "Cristiano Adamov",
    "Elena Hufton",
    "Zeb McKie",
    "Liz Luchetti",
    "Florette Rolling",
    "Chico Allgood",
    "Malvin Checcuzzi",
    "Kristina Skeath",
    "Vittoria Chesnut",
    "Arlinda Rival",
    "Alissa Gaye",
    "Nicolas Lavell",
    "Hillyer Sweating",
    "Bruis Northfield",
    "Donal Rought",
    "Maitilde Knotton",
    "Lezley Palfreeman",
    "Benedikt Ort",
    "Maurine Lennox",
    "Angel Hodgets",
    "Dona Fitt",
    "Krystyna Melmoth",
    "Mollee Clyne",
    "Zacherie O'Feeney",
    "Benton Habble",
    "Sophie Greason",
    "Koo Becket",
    "Celina Trounson",
    "Rubetta Aish",
    "Bree Fawcitt",
    "Trenton Hoult",
    "Bamby Annear",
    "Tersina Humbatch",
    "Kylie Besant",
    "Finlay McGreay",
    "Lydia Bourges",
    "Vin Freiburger",
    "Jephthah Schankel",
    "Tiphany Baxter",
    "Portia Fay",
    "Nadiya Rolls",
    "Harwilll Amthor",
    "Armand Smalridge",
    "Benedicto Fasset",
    "Alisa Hulbert",
    "Lethia Gomme",
    "Kristine Stoll",
    "Rene Ginglell",
    "Jacenta Scopyn",
    "Aloysia Budding",
    "Michelle Macveigh",
    "Jakie Atthowe",
    "Madison Nagle",
    "Wolfy McRill",
    "Lorrie Brass",
    "Anderea Hariot",
    "Chevalier Ugoletti",
    "Cordelia Schnitter",
    "Maximo Kryska",
    "Cherice Weston",
    "Kimberli Mallall",
    "Mahmoud Lidgey",
    "Kanya Sample",
    "Christel Elliot",
    "Meyer Rosoni",
    "Lilllie O' Driscoll",
    "Ase Balwin",
    "Caldwell Garron",
    "Rudolph Cashen",
    "Carmelia Reisen",
    "Maynord Horrell",
    "Adriano Marcq",
    "Coraline Tevlin",
    "Vicky Balke",
    "Galven O' Reagan",
    "Rani Garmanson",
    "Cody Ilyushkin",
    "Dagny Grzegorzewicz",
    "Aline Tirrell",
    "Griswold Earingey",
    "Alwin Crole",
    "Rurik Shiers",
    "Karole Simononsky",
    "Paulita Jervoise",
    "Gaston Garvan",
    "Syd Dovermann",
    "Alexandros Grouen",
    "Nick Hassell",
    "Aigneis Strutt",
    "Sigmund Hurdedge",
    "Art Floweth",
    "Ganny McGuiness",
    "Friedrick Pennings",
    "Myrle Kornas",
    "Garik Demonge",
    "Nessie Greyes",
    "Osbert Leaney",
    "Sibilla Byneth",
    "Abran Torrans",
    "Dede Dinsdale",
    "Joline Gardiner",
    "Brendin Heckle",
    "Patrick Bleibaum",
    "Phaedra Moyer",
    "Ransom Grigaut",
    "Mikol Brychan",
    "Lark Goodbur",
    "Tymothy Darnborough",
    "Rosana McCafferky",
    "Thaddeus MacFarlan",
    "Wilie Celier",
    "Rogers Skirrow",
    "Jaquenette Skep",
    "Reena Blaszczak",
    "Kippy Jaeggi",
    "Camila Dono",
    "Orsola Fatkin",
    "Dorita Eplate",
    "Bay Paunton",
    "Sianna Ivkovic",
    "Daffie Tosdevin",
    "Ronny Goodread",
    "Frank Gaitskill",
    "Gretel Blondel",
    "Lonnie McCrohon",
    "Stavro Uttridge",
    "Mable Mulcahy",
    "Madeline Poulston",
    "Halimeda Popeley",
    "Alison Kinneally",
    "Nat Rhucroft",
    "Austin Scanterbury",
    "Agustin Eeles",
    "Karry Bruyet",
    "Ashby Shevlane",
    "Violetta Paskin",
    "Michaeline Dormon",
    "Deidre Arnson",
    "Augie Wormleighton",
    "Elroy Murrow",
    "Vladamir Verner",
    "Vinnie Geaney",
    "Analise Hunnisett",
    "Diannne Marshal",
    "Klarika M'Quharge",
    "Orsola Pinar",
    "Odele Greenland",
    "Holt Delia",
    "Danette Clilverd",
    "Garrett Flowerden",
    "Iormina Darnbrook",
    "Ade Iacovielli",
    "Marijo McKennan",
    "Brigitta Arsey",
    "Herta Dolligon",
    "Liza Pole",
    "Bamby Loughrey",
    "Corrianne Purcer",
    "Tibold Alejandre",
    "Cort Hamshere",
    "Ryun Davids",
    "Broderick Sharpless",
    "Rip Bengall",
    "Flossie Melonby",
    "Fanny Mylan",
    "Hymie Banishevitz",
    "Isacco Sandes",
    "Livvyy Suddell",
    "Hebert Ausiello",
    "Nonna Remon",
    "Reeva Blunsum",
    "Arlen Gowers",
    "Marj MacAvaddy",
    "Sheena Redman",
    "Guy Mattek",
    "Rodina Habbin",
    "Annamarie Blencowe",
    "Nicolle Dedenham",
    "Hillery Procter",
    "Salli Langelaan",
    "Bethany Alldred",
    "Issy Worsnop",
    "Loutitia Titmarsh",
    "Shaylah Holehouse",
    "Christel Willeson",
    "Garold Rupke",
    "Irving Yelden",
    "Ewan Arger",
    "Joya Pudden",
    "Ignazio Moggie",
    "Venita Grazier",
    "Hayward Rylands",
    "Fiorenze Corradengo",
    "Valdemar Thurman",
    "Davina Seville",
    "Israel Atrill",
    "Harmony Wiseman",
    "Nolana Heak",
    "Jacquelin Milne",
    "Erina Sugg",
    "Salaidh Ginnety",
    "Seth Demer",
    "Lyndsie Holtum",
    "Johannes Grainge",
    "Levey Dowber",
    "Jeno Worgan",
    "Alastair Karchowski",
    "Devi Benedidick",
    "Burl Letson",
    "Cordula Ridsdole",
    "Shalne Frearson",
    "Waylon Athersmith",
    "Deborah Dorset",
    "Magdaia Burtt",
    "Preston Polglaze",
    "Ninette Peeters",
    "Pru Bridgstock",
    "Eilis Isworth",
    "Shepherd Leckey",
    "Dene Doogood",
    "Andee Noddles",
    "August Davioud",
    "Leonid Prozescky",
    "Tamas Obert",
    "Madelene Gettings",
    "Reginauld Torel",
    "Murielle Ablewhite",
    "Libbey Seniour",
    "Daryn Vinck",
    "Desirae Greggor",
    "Nana Antwis",
    "Carny Seakings",
    "Jasun Osipov",
    "Julissa D'Alessio",
    "Staci Toun",
    "Ellene Ranvoise",
    "Sofia McDyer",
    "Dynah Sandy",
    "Steffie Parsley",
    "Nelson Plail",
    "Marin Szimoni",
    "Sheila-kathryn Greengrass",
    "Adelaide Kinsman",
    "Ives Pridden",
    "Moe Dinkin",
    "Rosaline Cranston",
    "Janis Keenor",
    "Amalle Bourdis",
    "Gawen Beckhouse",
    "Quinlan Klass",
    "Kimbell Grisedale",
    "Dian Kildea",
    "Atlante Skalls",
    "Kenton Cadalleder",
    "Max Lote",
    "Lucilia Chismon",
    "Cassandre Epperson",
    "Josy Heppenspall",
    "Haley Kennet",
    "Olly Quartley",
    "Legra Churchlow",
    "Gabi Dulson",
    "Abra Slocket",
    "Haley Rebanks",
    "Yasmin Faragan",
    "Ferdy Halwill",
    "Mariette De Souza",
    "Rodina Restall",
    "Hilde Chaucer",
    "Abram Elcum",
    "Griff Morefield",
    "Leeanne Pinilla",
    "Timothea Fahy",
    "Zia Goldstraw",
    "Stu Wallis",
    "Bat Matschoss",
    "Yank Dwyr",
    "Brendon Shortt",
    "Estrella Churchin",
    "Anastasie Mash",
    "Fred Higgoe",
    "Karine Holhouse",
    "Rooney Dunphy",
    "Rand Hylands",
    "Kikelia Girardengo",
    "Noemi Moore",
    "Lia Cheake",
    "Tiena Ghion",
    "Rabi Kemish",
    "Dulce Honisch",
    "Christophe Ferruzzi",
    "Renaud Cescon",
    "Gawain Brosenius",
    "Jen Corbet",
    "Ty Tomasz",
    "Frederic Sketcher",
    "Kenyon Potteridge",
    "Carolin Flintiff",
    "Prescott Melrose",
    "Walker Bartolozzi",
    "Dominique Lamminam",
    "Stanfield Fitchell",
    "Karlyn Bruni",
    "Rena Treece",
    "Caterina Belson",
    "Verge Bartholomieu",
    "Karena Burgon",
    "Ezechiel Nisuis",
    "Yoshiko Trowel",
    "Uri Blunkett",
    "Jillane Sandlin",
    "Brinn Burbudge",
    "Alla Geraldo",
    "Veradis Mabbot",
    "Missy Element",
    "Abeu Lidden",
    "Spencer Breslau",
    "Beulah Gregory",
    "Abbey Caldow",
    "Woodie Coull",
    "Amelie McClory",
    "Avis Eivers",
    "Randall Oxenham",
    "Isidoro Boatswain",
    "Nita Ugoni",
    "Shara Schiell",
    "Marya Sleigh",
    "Skipp Henriques",
    "Marcela Ivey",
    "Mikol Doyle",
    "Garry Polak",
    "Kurt Wearing",
    "Marty Blasio",
    "Tiebout Loache",
    "Courtenay McGuane",
    "Merrile Marklew",
    "Konstantin Commin",
    "Quintina Delgado",
    "Ricki Cutchie",
    "Curr Scraney",
    "Andrus Gallard",
    "Sally Corneck",
    "Rorie Sibery",
    "Lauri Le Marquis",
    "Mendel Coppo",
    "Aime Smallcomb",
    "Bastien Reedshaw",
    "Malva Morrall",
    "Marietta Blair",
    "Shawn Perrigo",
    "Frederick Hovey",
    "Alonso McGoon",
    "Carissa Freeborn",
    "Perri Tunuy",
    "Adora Ivanets",
    "Isidoro Cleugher",
    "Bendicty Moon",
    "Clemence Shilling",
    "Yorgo Batie",
    "Marya Brodie",
    "Bridgette Kettle",
    "Joe Bleasdille",
    "Charlot Wordley",
    "Tyler Saladin",
    "Avery Shopcott",
    "Sayers Feldmark",
    "Consalve Corson",
    "Daven Whittleton",
    "Florian Cockle",
    "Lotta Ferrieri",
    "Calypso Cooke",
    "Grover Laying",
    "Lon Andriulis",
    "Kiel Rabb",
    "Marketa Giraldo",
    "Mimi Maddra",
    "Colly Folca",
    "Kellia Lennard",
    "Zoe Ivanikov",
    "Kliment McBlain",
    "Mycah Jaulme",
    "Jack Senten",
    "Theo Poinsett",
    "Zitella Staden",
    "Danya Burman",
    "Coletta Zoppie",
    "Linn Pretious",
    "Gisela Stratz",
    "Briano Collinette",
    "Dana Fielders",
    "Othello Olenchenko",
    "Ximenez Kenwright",
    "Ana Streatfield",
    "Derrik Fairey",
    "Stacy Arnald",
    "Ike Siret",
    "Bailey Mealiffe",
    "Abbie Benning",
    "Rebe Colebourn",
    "Barry Roomes",
    "Che Jendrys",
    "Keven Eccleshall",
    "Menard Saintsbury",
    "Kenna Lafuente",
    "Tobey Farfull",
    "Johnath Lordon",
    "Carroll Rundall",
    "Alla Suffield",
    "Morgen Minards",
    "Godfrey Swayland",
    "Spenser Simnor",
    "Venus Glazier",
    "Taryn Barbe",
    "Jakob Owthwaite",
    "Hussein Broy",
    "Waldo Kimmerling",
    "Xylia Waterman",
    "Bartie Wandtke",
    "Kit Antusch",
    "Paddie O'Hagerty",
    "Lawry Pittham",
    "Osgood Delahunty",
    "Heinrik Aaron",
    "Yurik Criple",
    "Wallis Fair",
    "Velma Chivers",
    "Perren Hammill",
    "Dalli Hufton",
    "Jozef Batho",
    "Thayne Burroughes",
    "Kyle Tomley",
    "Allie MacCorley",
    "Delaney Lukehurst",
    "Theressa Labusquiere",
    "Yoshi Dimitrie",
    "George Coultard",
    "Harwilll Labbe",
    "Gabriell Brandle",
    "Jodi Nicklen",
    "Kania Parker",
    "Hermy Chaffyn",
    "Rozanne Dust",
    "Maridel Bear",
    "Celinda Colvin",
    "Tiffi Barlace",
    "Johnna Merrington",
    "Ekaterina Trengrove",
    "Bendite Palle",
    "Patrice Tumelty",
    "Vincents Drinkhill",
    "Shermie Gowrich",
    "Jimmy Catenot",
    "Gun Coggings",
    "Ruth Truelock",
    "Filip Pavlishchev",
    "Stewart Werndly",
    "Ambros Dashkov",
    "Muire Janzen",
    "Roland Muncey",
    "Joey Pavolillo",
    "Devy Jeffs",
    "Korie Matteau",
    "Isabelita Questier",
    "Stephi Parramore",
    "Flossie Ivashintsov",
    "Elton Stock",
    "Randolf Fawlo",
    "Marta Sember",
    "Fremont Gyrgorcewicx",
    "Brandais Shorter",
    "Sutherlan Desporte",
    "Ashli Porte",
    "Lizzy Sutehall",
    "Annecorinne Wilfinger",
    "Kimberly Pilling",
    "Tani Blaksley",
    "Jonell Mannooch",
    "Corny Warsop",
    "Catha Bulter",
    "Jayme Williscroft",
    "Gina Gomme",
    "Wittie Southouse",
    "Carlye O'Farrell",
    "Octavia Janous",
    "Kirbie Isbell",
    "Nathan Iacovuzzi",
    "Shir Ducham",
    "Viviana Dedman",
    "Adelbert Durran",
    "Ainslie Chell",
    "Dene Rudman",
    "Dorthea Girauld",
    "Donni Bumpas",
    "Fan Ramage",
    "Quint Riggey",
    "Traci Kibbe",
    "Linell Broadey",
    "Sylvester Cull",
    "Esta Hellin",
    "Molly Dorot",
    "Herschel Ringer",
    "Matthew Goublier",
    "Hephzibah Strugnell",
    "Barbaraanne Kehir",
    "Casey Widdocks",
    "Jacobo Oglesbee",
    "Raynell Finkle",
    "Marten Pawling",
    "Cherie Mileham",
    "Tobit Pickford",
    "Edvard Blake",
    "Robyn Hendriksen",
    "Bernete O'Mullaney",
    "Lawton Daniele",
    "Kelsy Fishley",
    "Isobel Swanbourne",
    "Chance Brason",
    "Alis Tyzack",
    "Arleta Stoodale",
    "Vonny Ratter",
    "Malcolm Iacopetti",
    "Sherwood Vasilkov",
    "Henka Swenson",
    "Lucho Davydzenko",
    "Graig Coots",
    "Sherrie O'Cahsedy",
    "Paco Lissandre",
    "Lauri Heffer",
    "Launce Tschirasche",
    "Kattie Arondel",
    "Mortie Percival",
    "Drucie Duignan",
    "West Freke",
    "Brinn Proudman",
    "Aryn Desouza",
    "Mara Blas",
    "Adolpho Viall",
    "Kerianne Goaks",
    "Luis Axcel",
    "Duane Blas",
    "Karon McLauchlin",
    "Marthena Ing",
    "Marya Offener",
    "Warde Van der Krui",
    "Dulcy Clayhill",
    "Ingram Posnett",
    "Elsworth Trow",
    "Rodolfo Alvar",
    "Avril Earney",
    "Rozanna Staunton",
    "Welch Hospital",
    "Dex Krauze",
    "Luca Sabben",
    "Eveleen Coad",
    "Sherrie Jakubowsky",
    "Galen Summerfield",
    "Ambrose Heineking",
    "Josh Deinhard",
    "Tobe Treeby",
    "Maude Banker",
    "Viviana Shafier",
    "Jeanne Tidbald",
    "Bran Geldeard",
    "Will O'Hallagan",
    "Clarence Roseveare",
    "Al Kurdani",
    "Josephina Merryfield",
    "Inglebert Allardyce",
    "Roscoe Payn",
    "Aarika Khomich",
    "Petra Millican",
    "Rodrigo Joubert",
    "Bree Hollyman",
    "Perice Cowlin",
    "Christophe Oulet",
    "Dollie Ciccottio",
    "Evvy Castel",
    "Ive Jancik",
    "Kenton Clyde",
    "Ofella Evins",
    "Freddy Saffon",
    "Morgana Quarless",
    "Jobina Bradly",
    "Sibbie Ruggiero",
    "Linnell Baldree",
    "Pippo LLelweln",
];

function name(code) {
    return names[code % names.length].trim();
}

main();

