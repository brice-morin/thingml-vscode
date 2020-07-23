'use strict';

import * as net from 'net';

import {Trace} from 'vscode-jsonrpc';
import { window, workspace, commands, ExtensionContext, Uri, Terminal } from 'vscode';
import { LanguageClient, LanguageClientOptions, StreamInfo, Position as LSPosition, Location as LSLocation, ServerOptions } from 'vscode-languageclient';

import { exec } from 'child_process'
import os = require('os')
import path = require('path')
import { resolve } from 'path';

function startThingML(context: ExtensionContext) {
    return new Promise(resolve => {
        const terminal = window.createTerminal({
            name: `ThingML LSP Server`,
            hideFromUser: true
        } as any);    
        terminal.sendText('java -jar ' + context.asAbsolutePath(path.join('server', 'thingml.ide-2.0.0-SNAPSHOT-ls.jar')).replace(/\\/g,'\\\\'))    
        setTimeout(() => {
          resolve('OK');
        }, 2000);
    });
}

function generateCode(terminal: Terminal, context: ExtensionContext, compiler: String, source: String, output: String) {    
    terminal.sendText('java -cp ' + context.asAbsolutePath(path.join('server', 'thingml.ide-2.0.0-SNAPSHOT-ls.jar ')).replace(/\\/g,'\\\\'), false)
    terminal.sendText('org.thingml.compilers.commandline.Main --compiler ' + compiler + ' --source ' + source.replace(/\\/g,'\\\\') + ' --output ' + output.replace(/\\/g,'\\\\'))    
    //terminal.dispose()
}

export async function activate(context: ExtensionContext) {
    const serverPort = 5008

    const result = await startThingML(context)    
    console.log(result);

    // The server is a started as a separate app and listens on port 5008
    let connectionInfo = {
        port: serverPort
    };
    let serverOptions = () => {
        // Connect to language server via socket
        let socket = net.connect(connectionInfo);
        let result: StreamInfo = {
            writer: socket,
            reader: socket
        };
        return Promise.resolve(result);
    };

    let clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'thingml' }],
        synchronize: {
			// Notify the server about file changes to *.thingml files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.thingml')
		}
	};

    // Create the language client and start the client.
    let lc = new LanguageClient('ThingMLXtextServer', 'ThingML Xtext Server', serverOptions, clientOptions);

    // enable tracing (.Off, .Messages, Verbose)
    lc.trace = Trace.Verbose;
    let disposable = lc.start();

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);


    const terminal = window.createTerminal({
        name: `ThingML Compiler`
    } as any);    

    let compileJava = commands.registerTextEditorCommand('thingml.compile.java', (texteditor, edit, args) => {
        console.log('Compiling ' + texteditor.document.uri.fsPath.toString() + ' to Java...')
        generateCode(terminal, context, 'java', texteditor.document.uri.fsPath.toString(), path.join(path.dirname(texteditor.document.uri.fsPath), 'thingml-gen', 'java'))
    })
    context.subscriptions.push(compileJava)

    let compilePosix = commands.registerTextEditorCommand('thingml.compile.posix', (texteditor, edit, args) => {
        console.log('Compiling ' + texteditor.document.uri.fsPath.toString() + ' to POSIX/C')
        generateCode(terminal, context, 'posix', texteditor.document.uri.fsPath.toString(), path.join(path.dirname(texteditor.document.uri.fsPath), 'thingml-gen', 'posix'))
    })
    context.subscriptions.push(compilePosix)

    let compileArduino = commands.registerTextEditorCommand('thingml.compile.arduino', (texteditor, edit, args) => {
        console.log('Compiling ' + texteditor.document.uri.fsPath.toString() + ' to Arduino/C')
        generateCode(terminal, context, 'arduino', texteditor.document.uri.fsPath.toString(), path.join(path.dirname(texteditor.document.uri.fsPath), 'thingml-gen', 'arduino'))
    })
    context.subscriptions.push(compileArduino)

    let compileGo = commands.registerTextEditorCommand('thingml.compile.go', (texteditor, edit, args) => {
        console.log('Compiling ' + texteditor.document.uri.fsPath.toString() + ' to Go')
        generateCode(terminal, context, 'go', texteditor.document.uri.fsPath.toString(), path.join(path.dirname(texteditor.document.uri.fsPath), 'thingml-gen', 'go'))
    })
    context.subscriptions.push(compileGo)

    let compileNodeJS = commands.registerTextEditorCommand('thingml.compile.nodejs', (texteditor, edit, args) => {
        console.log('Compiling ' + texteditor.document.uri.fsPath.toString() + ' to NodeJS')
        generateCode(terminal, context, 'nodejs', texteditor.document.uri.fsPath.toString(), path.join(path.dirname(texteditor.document.uri.fsPath), 'thingml-gen', 'nodejs'))
    })
    context.subscriptions.push(compileNodeJS)

    let compileBrowser = commands.registerTextEditorCommand('thingml.compile.browser', (texteditor, edit, args) => {
        console.log('Compiling ' + texteditor.document.uri.fsPath.toString() + ' to JS for browser')
        generateCode(terminal, context, 'browser', texteditor.document.uri.fsPath.toString(), path.join(path.dirname(texteditor.document.uri.fsPath), 'thingml-gen', 'browser'))
    })
    context.subscriptions.push(compileBrowser)

    let compileUML = commands.registerTextEditorCommand('thingml.compile.uml', (texteditor, edit, args) => {
        console.log('Compiling ' + texteditor.document.uri.fsPath.toString() + ' to UML')
        generateCode(terminal, context, 'uml', texteditor.document.uri.fsPath.toString(), path.join(path.dirname(texteditor.document.uri.fsPath), 'thingml-gen', 'uml'))
    })
    context.subscriptions.push(compileUML)
}
