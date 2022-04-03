const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const {body, validationResult} = require('express-validator');
const socketIO = require("socket.io");
const qrcode = require('qrcode');
const http = require('http');
const fs  = require('fs');
const { phoneNumberFormatter } = require('./helpers/helper.js');

const app = express();
const server = http.createServer(app);
const io  = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({extended : true}));

app.get("/",(req, res) => {
    res.sendFile("index.html", {root : __dirname});
})

// Whatsapp

const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if(fs.existsSync(SESSION_FILE_PATH)){
    sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({
    restartOnAuthFail : true,
    puppeteer : {
        args : [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- this one doesn't works in Windows
            '--disable-gpu'
        ],
        headless : true
    },
    session : sessionCfg
});


client.initialize();

// Socket Io
io.on("connection",function(socket){
    socket.emit("message" , "Connecting!");

    // Whatsapp
    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr,(err,url) => {
            socket.emit("qr",url);
            socket.emit("message","QR Code Received");
        })
    });

    client.on('ready', () => {
        console.log('Whatsapp is ready!');
        socket.emit("ready","Whatsapp is ready!");
        socket.emit("message","Whatsapp is ready!");
    });

    client.on('authenticated', (session) => {
        socket.emit("authenticated","Whatsapp is authenticated!");
        socket.emit("message","Whatsapp is authenticated!");

        console.log("AUTHENTICATED",session);
        sessionCfg = session;
        fs.writeFile(SESSION_FILE_PATH,JSON.stringify(session),function(err){
            if(err){
                console.log(err);
            }
        })
    
    });
})

const checkRegisteredNumber = async (number) => {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}

// End Point
app.post("/send-message",[
    body('number').notEmpty(),
], async (req,res) => {
    const errors     = validationResult(req).formatWith( ({msg}) => {
        return msg;
    } )

    if(!errors.isEmpty()){
        return res.status(422).json({
            status : false,
            message : errors.mapped()
        })
    }

    const number    = phoneNumberFormatter(req.body.number);
    let message   = req.body.message;
    let option = {};
    if(req.body.media != undefined){
        message     = MessageMedia.fromFilePath(req.body.media);
        option  = {
            caption : req.body.message
        }
    }

    if((req.body.message == undefined || req.body.message == "") && req.body.media == undefined ){
        return res.status(500).json({
            status : false,
            message : "Invalid Request"
        });
    }


    if(req.body.file){

    }

    const isRegistered = await checkRegisteredNumber(number);
    if(!isRegistered){
        res.status(500).json({
            status : false,
            message : "The Number is not registered!"
        });
    }

    client.sendMessage(number,message,option).then(response => {
        res.status(200).json({
            status : true,
            response : response
        })
    }).catch(err => {
        res.status(500).json({
            status : false,
            response : number
        });
    });
})


server.listen(8000,function(){
    console.log("App Running on *:",8000)
})