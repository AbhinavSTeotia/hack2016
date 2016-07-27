'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as net from 'net';
import * as os from 'os';
import * as dns from 'dns';
import request = require('request');

export enum MessageType {
    ChatMessage,
    TextEditing,
    JoinPairProgramming,
    fileContent
}

export class Message {
    type: MessageType;
    data: any;
    fileName: string;
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

    public static getJoinPairProgrammingMessage(){
        let message = new Message();
        message.type = MessageType.JoinPairProgramming;
        message.data = getExternalIp();
        return message;
    }

    public static getSendFileMessage(fileName, fileContent){
        let message = new Message();
        message.type = MessageType.fileContent;
        message.data = fileContent;
        message.fileName = fileName;
        return message;
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "pairprogramming" is now active!');
    registerStartPairProgrammingCommand();
    registerJoinPairProgrammingCommand();
    registerChatCommand();
    registerCodeSearchCommand();
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
            if(remoteHostIP){
                sendMessageToServerIP(obj);
            }
            else{
                dns.resolve(remoteHostName, (err, addresses)=>{
                    if(addresses && addresses[0]){
                        remoteHostIP = addresses[0];
                        sendMessageToServerIP(obj);
                    }
                });
            }
        } else {
            tcpClient.write(JSON.stringify(obj));
        } 
    }, 100); 
}

function sendMessageToServerIP(obj){
    tcpClient = net.createConnection({port: 6969, host: remoteHostIP}, ()=>{
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

function initTcpServer(){
    if(!tcpServer){
        var externalIp = getExternalIp();
        tcpServer = net.createServer(function(sock) {
            //sock.pipe(sock);
            // Add a 'data' event handler to this instance of socket
            sock.on('data', function(data) {
                onServerMessageRecieved(data);
            });
            
            // Add a 'close' event handler to this instance of socket
            sock.on('close', function(data) {
            });
        }).listen(6969, externalIp);
    }
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
    switch (message.type) {
        case MessageType.ChatMessage:
            var msg = "Peer : " + message.data;
            console.log(msg);
            showMessageOnStatusBar(msg);    
            break;
        case MessageType.TextEditing:
            handleTextEditing(message.data);    
            break;
        case MessageType.JoinPairProgramming:
            var msg = "Started session with "+ message.data;
            console.log(msg);
            showMessageOnStatusBar(msg);
            remoteHostIP = message.data;
            tcpClient = null;
            sendOpenFileToPeer();  
            break;
        case MessageType.fileContent:
            openNewFile(message);
            break;
        default:
            break;
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

function registerStartPairProgrammingCommand(){
    vscode.commands.registerCommand("extension.startPairProgramming", ()=> {
        var msg = "Pair programming is active, waiting for peer to join.";
        showMessageOnStatusBar(msg);
        console.log(msg);
        initTcpServer();
        //     vscode.window.showInputBox().then((str : string) => {
        //         var msg = "Pair programming is active, waiting for peer to join.";
        //         showMessageOnStatusBar(msg);
        //         console.log(msg);
        //         remoteHostName = str;
        // }); 
    });
}

function registerJoinPairProgrammingCommand(){
    vscode.commands.registerCommand("extension.joinPairProgramming", ()=> {
        var msg = "Input host for pair programming session.";
        showMessageOnStatusBar(msg);
        console.log(msg);
        vscode.window.showInputBox().then((str : string) => {
            initTcpServer();
                var msg = "Joining peer programming session to "+ str;
                showMessageOnStatusBar(msg);
                console.log(msg);
                remoteHostName = str;
                sendMessageToServer(MessageHelper.getJoinPairProgrammingMessage());
        }); 
    });
}

function registerCodeSearchCommand(){
    vscode.commands.registerCommand("extension.codeSearch", ()=> {
            vscode.window.showInputBox().then((str : string) => {
               stackOverflowCodeSnippet(str);
        }); 
    });
} 

function openNewFile(message) {
    var newFileUri = vscode.Uri.parse("untitled:"+message.fileName+".cs");
    vscode.workspace.openTextDocument(newFileUri).then((doc)=>{
        vscode.window.showTextDocument(doc).then((editor: vscode.TextEditor) => {
            editor.edit((editBuilder: vscode.TextEditorEdit)=>{
                var pos1 = new vscode.Position(0,0);
                acquireLock();
                editBuilder.insert(pos1, message.data);
                setTimeout(function(){ releaseLock(); }, 100);
                });
        })
    });
}

function handleTextEditing(data: any) {
    var clientMessage = <vscode.TextDocumentChangeEvent>(data);
    let filePath = data.document.uri.fsPath;
    let results = filePath.split('\\');
    var tempFileName = "c:\\temp\\"+results[results.length-1];
    var newFileUri = vscode.Uri.parse("untitled:"+tempFileName);        

    vscode.workspace.findFiles(results[results.length-1], "").then((uris: vscode.Uri[])=> {
        vscode.workspace.openTextDocument(uris[0]).then(
            (doc) => {
                vscode.window.showTextDocument(doc).then((editor: vscode.TextEditor) => {                   
                editor.edit((editBuilder: vscode.TextEditorEdit)=>{
                var pos1 = new vscode.Position(clientMessage.contentChanges[0].range[1].line, clientMessage.contentChanges[0].range[1].character);
                var pos2 = new vscode.Position(clientMessage.contentChanges[0].range[0].line, clientMessage.contentChanges[0].range[0].character);
                var newRange = new vscode.Range(pos1, pos2);
                acquireLock();
                editBuilder.replace(newRange, clientMessage.contentChanges[0].text);
                setTimeout(function(){ releaseLock(); }, 100);
                });
            });                                 
        });
    });
}

function sendOpenFileToPeer(){
    var fileName = vscode.window.activeTextEditor.document.fileName;
    var fileContent = vscode.window.activeTextEditor.document.getText();
    sendMessageToServer(MessageHelper.getSendFileMessage(fileName, fileContent));
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

export function stackOverflowCodeSnippet(str: string) {
    let codeMessage = `static void a() {
    ///${str} 
    }`;
    let len = str.length + 3;

    (request).post({url: 'http://codesnippet.research.microsoft.com/api/CodeSnippet/GetSnippetsFromWeb', form: {
    code: codeMessage, 
    cursorX: '' + len,
    cursorY: '1',
    limitDomains: true
    }}, function(err, httpResponse, body) {
    let response = JSON.parse(body);
    console.log(response.items[0].code);
    var filePath = "untitled:c:\\temp\\codeSearchResult.txt";
    
    vscode.workspace.openTextDocument(vscode.Uri.parse(filePath)).then(
            (doc) => {
                vscode.window.showTextDocument(doc,2).then((editor: vscode.TextEditor) => {                   
                editor.edit((editBuilder: vscode.TextEditorEdit)=>{
                    editBuilder.insert(new vscode.Position(0,0), response.items[0].code);
                });
            });
        });
    });
}

export var remoteHostName = "abhinasi-dev.fareast.corp.microsoft.com";
export var remoteHostIP;
export var lock = false;
export var tcpServer;
export var tcpClient;