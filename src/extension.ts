'use strict';

import * as net from 'net';

import {Trace} from 'vscode-jsonrpc';
import { window, workspace, commands, ExtensionContext, Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions, StreamInfo, Position as LSPosition, Location as LSLocation, ServerOptions } from 'vscode-languageclient';

import { exec } from 'child_process'
import os = require('os')
import path = require('path')
import { resolve } from 'path';

function startThingML(context: ExtensionContext) {
    return new Promise(resolve => {
        const terminal = window.createTerminal({
            name: `ThingML LSP Server`/*,
            hideFromUser: true*/
        } as any);    
        terminal.sendText('java -jar ' + context.asAbsolutePath(path.join('server', 'thingml.ide-2.0.0-SNAPSHOT-ls.jar')).replace(/\\/g,'\\\\'))    
        setTimeout(() => {
          resolve('OK');
        }, 2000);
    });
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
}
