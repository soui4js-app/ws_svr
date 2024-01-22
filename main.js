import * as soui4 from "soui4";
import * as std from "std";
import {R} from "uires/R.js";
import * as ws4js from "ws4js.dll"

var g_workDir="";

class WsServer extends ws4js.WsServer{
    constructor(mainDlg){
		super();
		this.mainDlg = mainDlg;
		this.startId = 0;
		this.conns = new Map();
		this.onConnected = this.onConn;
		this.onDisconnect = this.onDiscon;
		this.onText = this.onText2;
	}

	getArgsObj(uriArgs){
		var regex = /(\w+)=([^&=]+)/g;
		var match;
		var values = {};
	
		while ((match = regex.exec(uriArgs)) !== null) {
		var key = match[1];
		var value = match[2];
		values[key] = value;
		}
		return values;
	}

	getPeers(){
		let ret = [];
		this.conns.forEach(function(value,key){
			ret.push({id:key,name:value.name});
		});
		return ret;
	}

	broadcast(str){
		this.conns.forEach(function(value,key){
			value.conn.sendText(str,-1);
		});
	}

	updatePeers(){
		let peers = this.getPeers();
		let data = {type:"peers",peers:peers};
		this.broadcast(JSON.stringify(data));
		this.mainDlg.updatePeers(peers);
	}

	onConn(conn,uriPath,uriArgs){
		console.log("path="+uriPath+" args="+uriArgs);
		this.startId += 1;
		let args = this.getArgsObj(uriArgs);
		let name = args["name"];
		if(name == undefined)
		   name="noname"+this.startId;
		conn.setId(this.startId);
		this.conns.set(this.startId,{conn:conn,name:name});
		conn.AddRef();
		let retId = {type:"id",id:this.startId};
		conn.sendText(JSON.stringify(retId),-1);
		this.updatePeers();
		return true;
	}

	onDiscon(conn){
		console.log("conn break, id="+conn.getId());
		this.conns.delete(conn.getId());
		conn.Release();
		this.updatePeers();
	}

	onText2(conn,str){
		console.log("recv from "+conn.getId() + " text="+str);
		try{
			let msg = JSON.parse(str);
			if(msg.type=="chat"){
				let to = msg.data.to;
				msg.data.from = conn.getId();
				//conn.sendText(JSON.stringify(msg),-1);
				if(to == -1){
					this.broadcast(JSON.stringify(msg));
				}else if(this.conns.has(to)){
					let peer = this.conns.get(to);
					peer.conn.sendText(JSON.stringify(msg),-1);
				}else{
					console.log("conn id not found "+to);
				}	
			}
		}catch(e){
			console.error("error",e);
		}
	}
}

class MainDialog extends soui4.JsHostWnd{
	constructor(){
		super("layout:dlg_main");
		this.onEvt = this.onEvent;
	}

	onEvent(e){
		if(e.GetID()==soui4.EVT_INIT){//event_init
			this.init();
		}else if(e.GetID()==soui4.EVT_EXIT){
			this.uninit();
		}
		return false;
	}
	
	onBtnStart(e){
		console.log("start server");
		let edit_port = this.FindIChildByName("edit_port");
		let strPort = edit_port.GetWindowText(true);
		let port = parseInt(strPort);
		let cert = g_workDir + "\\cert\\server.crt";
		let key = g_workDir + "\\cert\\server.key";
		let ret = this.ws_svr.start("websocket",port,true,cert,key);
	
		console.log("start ws server at port:"+port+" ret="+ret);
		if(ret == 0){
			this.FindIChildByName("btn_start").EnableWindow(false,true);
		}else{
			soui4.SMessageBox(this.GetHwnd(),"start server ret:"+ret,"error",soui4.MB_OK|soui4.MB_ICONERROR);
		}
	}

	updatePeers(peers){
		let txt = "";
		for(let i=0;i<peers.length;i++){
			txt = txt + JSON.stringify(peers[i]) + "\n";
		}
		this.FindIChildByName("edit_peers").SetWindowText(txt);
	}

	init(){
		console.log("init");
		this.ws_svr = new WsServer(this);
		soui4.SConnect(this.FindIChildByName("btn_start"),soui4.EVT_CMD,this,this.onBtnStart);
	}
	uninit(){
		this.ws_svr.quit();
		this.ws_svr = null;
		//do uninit.
		console.log("uninit");
	}
};


function main(inst,workDir,args)
{
	soui4.log(workDir);
	g_workDir = workDir;
	let theApp = soui4.GetApp();
	let res = theApp.InitXmlNamedID(R.name_arr,R.id_arr);
	console.log("InitXmlNamedID ret:",res);
	let souiFac = soui4.CreateSouiFactory();
	//*
	let resProvider = souiFac.CreateResProvider(1);
	soui4.InitFileResProvider(resProvider,workDir + "\\uires");
	//*/
	/*
	// show how to load resource from a zip file
	let resProvider = soui4.CreateZipResProvider(theApp,workDir +"\\uires.zip","souizip");
	if(resProvider === 0){
		soui4.log("load res from uires.zip failed");
		return -1;
	}
	//*/
	let resMgr = theApp.GetResProviderMgr();
	resMgr.AddResProvider(resProvider,"uidef:xml_init");
	resProvider.Release();
	let hwnd = soui4.GetActiveWindow();
	let hostWnd = new MainDialog();
	hostWnd.Create(hwnd,0,0,0,0);
	hostWnd.SendMessage(0x110,0,0);//send init dialog message.
	hostWnd.ShowWindow(soui4.SW_SHOWNORMAL); 
	souiFac.Release();
	let ret= theApp.Run(hostWnd.GetHwnd());
	hostWnd=null;
	soui4.log("js quit");
	return ret;
}

globalThis.main=main;