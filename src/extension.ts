'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import * as dns from 'dns';

export enum MessageType {
    ChatMessage,
    TextEditing
}

export class Message {
    type: MessageType;
    data: any;
} 

export class MessageHelper {
    public static getChatMessage(data: any) {
        let message = new Message();
        message.type = MessageType.ChatMessage;
        message.data = data;
        return message;
    }

    public static getTextEditorMessage(data: any) {
        let message = new Message();
        message.type = MessageType.TextEditing;
        message.data = data;
        return message;
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "pairprogramming" is now active!');
    
    // Initialize TCP server.
    tcpServer = initTcpServer();
    // Initialize TCP client.
    //tcpClient = initTcpClient();

    registerChatCommand();
    registerConnectCommand();

    // Add listner for text change event.
    vscode.workspace.onDidChangeTextDocument((textDocChanged: vscode.TextDocumentChangeEvent)=>{
        if(!lock){
            sendMessageToServer(MessageHelper.getTextEditorMessage(textDocChanged));
        }
    });

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed
        
        // Display a message box to the user
        vscode.window.showInformationMessage('Pair Programming!');
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function sendMessageToServer(obj){
    setTimeout(function(){
        if(!tcpClient){
            dns.resolve(remoteHostName, (err, addresses)=>{
                if(addresses && addresses[0]){
                    tcpClient = net.createConnection({port: 6969, host: addresses[0]}, ()=>{
                        tcpClient.write(JSON.stringify(obj));
                    });
                    tcpClient.on('data', (data)=>{
                    });
                    tcpClient.on('end', ()=>{
                        tcpClient = null;
                    });
                    tcpClient.on('close', ()=>{
                        tcpClient = null;
                    });
                }
            });
        } else {
            tcpClient.write(JSON.stringify(obj));
        }
        // tcpClient = initTcpClient();
        // tcpClient.connect(6969, remoteServerIP, ()=>{
        //     tcpClient.write(JSON.stringify(obj));
        // });  
    }, 100); 
}

function initTcpServer(){
    var externalIp = getExternalIp();
    var server = net.createServer(function(sock) {
        //sock.pipe(sock);
        // Add a 'data' event handler to this instance of socket
        sock.on('data', function(data) {
            onServerMessageRecieved(data);
        });
        
        // Add a 'close' event handler to this instance of socket
        sock.on('close', function(data) {
        });
    }).listen(6969, externalIp);
    return server;
}

function getExternalIp(): string{
    var address,
    ifaces = require('os').networkInterfaces();
    for (var dev in ifaces) {
        ifaces[dev].filter((details) => details.family === 'IPv4' && details.internal === false ? address = details.address: undefined);
    }
    return address;
}

function onServerMessageRecieved(data){
    var stringConverted = String.fromCharCode.apply(null, data);
    var message = <Message>JSON.parse(stringConverted);

    if(message.type === MessageType.ChatMessage) {
        var msg = "Peer : " + message.data;
        console.log(msg);
        showMessageOnStatusBar(msg);
    } else if(message.type === MessageType.TextEditing) {
            var clientMessage = <vscode.TextDocumentChangeEvent>(message.data);
            vscode.window.activeTextEditor.edit((editBuilder: vscode.TextEditorEdit)=>{
            var pos1 = new vscode.Position(clientMessage.contentChanges[0].range[1].line, clientMessage.contentChanges[0].range[1].character);
            var pos2 = new vscode.Position(clientMessage.contentChanges[0].range[0].line, clientMessage.contentChanges[0].range[0].character);
            var newRange = new vscode.Range(pos1, pos2);
            acquireLock();
            editBuilder.replace(newRange, clientMessage.contentChanges[0].text);
            setTimeout(function(){ releaseLock(); }, 100);
        });
    } 
}

function registerChatCommand(){
    vscode.commands.registerCommand("extension.chat", ()=> {
            vscode.window.showInputBox().then((str : string) => {
                var msg = "Me : " + str;
                showMessageOnStatusBar(msg);
                console.log(msg);
                sendMessageToServer(MessageHelper.getChatMessage(str));
        }); 
    });
}

function registerConnectCommand(){
    vscode.commands.registerCommand("extension.connect", ()=> {
            vscode.window.showInputBox().then((str : string) => {
                var msg = "Trying to connect to " + str;
                showMessageOnStatusBar(msg);
                console.log(msg);
                remoteHostName = str;
        }); 
    });
}

function showMessageOnStatusBar(str){
        var item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        item.text = str;
        item.show();
}

function acquireLock(){
    lock = true;
}

function releaseLock(){
    lock = false;
}

export var remoteHostName = "abhinasi-dev.fareast.corp.microsoft.com";
export var lock = false;
export var tcpServer;
export var tcpClient;