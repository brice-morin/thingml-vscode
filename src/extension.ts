'use strict';

import {connect} from 'net';

import {Trace} from 'vscode-jsonrpc';
import { window, workspace, commands, ExtensionContext, Terminal, ProgressLocation, Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions, StreamInfo } from 'vscode-languageclient';

import fs = require('fs')
import path = require('path')

const compilers = ['java', 'posix', 'arduino', 'go', 'nodejs', 'browser', 'uml']
const tools = ['monitor', 'monitor-bin', 'gomqttjson', 'javamqttjson', 'javascriptmqttjson', 'posixmqttjson']

function runInDocker(context: ExtensionContext) {
    let folder : Uri = workspace.workspaceFolders?.values().next().value.uri    
    compilers.forEach(compiler => {
        let dockerfile = Uri.joinPath(folder, 'thingml-gen', compiler, 'Dockerfile')
        workspace.fs.stat(dockerfile).then(
            (filestat) => {   
                if (filestat.size <= 0) return;             
                const terminal = window.createTerminal({
                    name: `Docker ` + compiler,
                    hideFromUser: false
                } as any);  
                terminal.show()               
                terminal.sendText('cd ' + Uri.joinPath(folder, 'thingml-gen', compiler).fsPath.toString().replace(/\\/g,'\\\\') + ' && docker build -t thingml/' + compiler + " . && docker run thingml/" + compiler)
            },
            (err) => {}
        )
    })
}

function startThingML(context: ExtensionContext) {
    return new Promise(resolve => {
        const terminal = window.createTerminal({
            name: `ThingML LSP Server`,
            hideFromUser: true
        } as any);    
        terminal.sendText('java -jar ' + context.asAbsolutePath(path.join('server', 'thingml.ide-2.0.0-SNAPSHOT-ls.jar')).replace(/\\/g,'\\\\'))    
        setTimeout(() => {
          resolve('OK');
        }, 1000);
    });
}

function generateCodeWithProgress(context: ExtensionContext, terminal: Terminal, compiler: string, source: string, output: string, isTool: boolean = false) {
    window.withProgress({
        location: ProgressLocation.Notification,
        title: 'Compiling ' + source + ' to ' + compiler + ' in folder ' + output,
        cancellable: false
    }, (progress, _token) => {        
		const p = new Promise(resolve => {
            let count = 0
            progress.report({increment: count})
            if (isTool) {
                generateTool(terminal, context, compiler, source, output)  
            } else {
                generateCode(terminal, context, compiler, source, output)  
            }            
            let timer: NodeJS.Timeout 
            timer = setInterval(()=>{
                count += 2
                if (count <= 100) {
                    progress.report({increment: count})
                } else {
                    clearInterval(timer)
                    resolve()
                }
            },200);
            fs.watch(output, () => {
                progress.report({increment: 100})
                clearInterval(timer)
                resolve()
            })            
        });        
        return p
    })
}

function generateCode(terminal: Terminal, context: ExtensionContext, compiler: string, source: string, output: string) { 
    console.log('Compiling ' + source + ' to ' + compiler + ' in folder ' + output)   
    terminal.sendText('java -cp ' + context.asAbsolutePath(path.join('server', 'thingml.ide-2.0.0-SNAPSHOT-ls.jar ')).replace(/\\/g,'\\\\'), false)
    terminal.sendText('org.thingml.compilers.commandline.Main --compiler ' + compiler + ' --source ' + source.replace(/\\/g,'\\\\') + ' --output ' + output.replace(/\\/g,'\\\\') + ' --create-dir')    
    terminal.show()
}

function generateTool(terminal: Terminal, context: ExtensionContext, tool: string, source: string, output: string) { 
    console.log('Instrumenting ' + source + ' with tool ' + tool)   
    terminal.sendText('java -cp ' + context.asAbsolutePath(path.join('server', 'thingml.ide-2.0.0-SNAPSHOT-ls.jar ')).replace(/\\/g,'\\\\'), false)
    terminal.sendText('org.thingml.compilers.commandline.Main --tool ' + tool + ' --source ' + source.replace(/\\/g,'\\\\') + ' --output ' + output.replace(/\\/g,'\\\\') + ' --create-dir')    
    terminal.show()
}

export async function activate(context: ExtensionContext) {
    const serverPort = 5008

    await startThingML(context)    
    
    // The server is a started as a separate app and listens on port 5008
    let connectionInfo = {
        port: serverPort
    };
    let serverOptions = () => {
        // Connect to language server via socket
        let socket = connect(connectionInfo);
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
    
    compilers.forEach(compiler => {
        let compile = commands.registerTextEditorCommand('thingml.compile.' + compiler, (texteditor, edit, args) => {
            const source = texteditor.document.uri.fsPath.toString()
            const output = path.join(workspace.workspaceFolders?.values().next().value.uri.path ?? '/tmp', 'thingml-gen', compiler)
            generateCodeWithProgress(context, terminal, compiler, source, output)
        })
        context.subscriptions.push(compile)
    });

    tools.forEach(tool => {
        let compile = commands.registerTextEditorCommand('thingml.tool.' + tool, (texteditor, edit, args) => {
            const source = texteditor.document.uri.fsPath.toString()
            const output = path.join(workspace.workspaceFolders?.values().next().value.uri.path ?? '/tmp', 'thingml-gen', tool)
            generateCodeWithProgress(context, terminal, tool, source, output, true)
        })
        context.subscriptions.push(compile)
    });    

    let run = commands.registerCommand('thingml.run.docker', () => {
        runInDocker(context)
    })
    context.subscriptions.push(run)

}
