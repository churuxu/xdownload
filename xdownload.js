const fs = require("fs");
const http = require("http");
const https = require('https');
const cp = require("child_process");
const crypto = require('crypto');


var this_dir_ = __dirname;
var url_ = "";
var file_ = "";

var username_ = "churuxu";
var projname_ = "downloader";
var api_url_joblist_ = "";


function md5(str){
	var hash = crypto.createHash("md5");
	hash.update(str);
	return hash.digest('hex');
}

//显示帮助
function do_help(){
	console.log("usage: xdownload [options] <url> <file>");
	console.log("options:");
	console.log("  -h --help    show help");
	console.log("  -s --setup   setup paramters");
	process.exit(1);
}

//提示错误选项
function do_error_opt(val){
	console.log("unknown option:" + val);	
	do_help();
}


//加载本地配置
function load_config(){
	api_url_joblist_ = "https://ci.appveyor.com/api/projects/" + username_ + "/"+ projname_ +"/history?recordsNumber=10";
}

//初始化本地配置
function do_setup(){
	console.log("Setup xdownload ...\n");
	load_config();
	//
	process.exit(1);
}

//异步等待，返回Promise
function sleep(ms){
	return new Promise(function(resolv, reject){
		setTimeout(resolv, ms);
	});
}

//http请求json，返回Promise，回调结果为json对象
function fetch_json(url){
	return new Promise(function(resolv, reject){
		var opt = {};	
		opt.headers = {};
		opt.headers.accept = "application/json, text/plain, */*";
		var body = "";
		var req = https.get(url, opt, function(res){
			res.on('data', function(chunk){
				body += chunk.toString();
			});
			res.on('end', function(){
				try{
					var obj = JSON.parse(body);
					resolv(obj);
				}catch(e){
					reject(e);
				}
			});
		});
		req.on('error', reject);
	});	
}

//下载文件
function download_file(url, file){
	return new Promise(function(resolv, reject){		
		var fstream = fs.createWriteStream(file);
		var req = https.get(url, opt, function(res){
			res.pipe(fstream);
			res.on('end', function(){
				fstream.end();
				resolv();
			});
		});
		req.on('error', reject);
	});	
}


//查找已经下载过的任务
async function find_build(commitmsg){
	var apiurl = "https://ci.appveyor.com/api/projects/" + username_ + "/"+ projname_ +"/history?recordsNumber=10";
	var obj = await fetch_json(apiurl);
	var builds = obj.builds;
	for(var i=0;i<builds.length;i++){
		if(builds[i].message == commitmsg){
			return builds[i];
		}
	}
	return null;
}

//创建appveyor.yml
function create_appveyor_yml(url, file){
	var res = "";
	res += "version: 1.0.{build}\n";
	res += "\n";
	res += "environment:\n";
	res += "\tNAME: file.bin\n";
	res += ("\tURL: "+url+"\n");
	res += "\n";
	res += "build_script:\n";
	res += "- cmd: curl -fsSL -o %NAME% %URL%\n";
	res += "\n";
	res += "artifacts:\n";
	res += "- path: $(NAME)\n";
	fs.writeFileSync(file, res);
}

//同步代码到git服务器
function do_update_src(commitmsg){
	var dir = this_dir_;
	cp.execSync("git pull", {cwd:dir}); 
	create_appveyor_yml(url_, dir + "/appveyor.yml");
	cp.execSync("git commit -am " + commitmsg, {cwd:dir});
	cp.execSync("git push", {cwd:dir}); 
}

//等待build结束, 返回一个新的build
async function wait_build_finish(build){
	if(build.status == "success"){
		return build;
	}
	var apiurl = "https://ci.appveyor.com/api/projects/" + username_ + "/"+ projname_ +"/builds/" + build.buildId;	
	for(var i=0;i<1000;i++){
		await sleep(2000);
		var obj = await fetch_json(apiurl);
		if(!obj || !obj.build)return false;
		if(obj.build.status == "success")return obj.build;
		if(obj.build.status == "failed")return false;
	}
	return false;
}

//执行下载流程
async function do_download(){
	load_config();
	var commitmsg = md5(url_);
	
	//查找已有任务
	var build = await find_build(commitmsg);
	if(!build || build.status == "failed"){ //如果不存在或失败
		//重新同步代码
		do_update_src(commitmsg);
		await sleep(3000);
		//上传代码后再查找任务
		build = await find_build(commitmsg);
		if(!build){
			await sleep(3000);
			build = await find_build(commitmsg);
		}
		if(!build){
			console.log("Error, can not find build in https://ci.appveyor.com/project/" + username_ + "/"+ projname_ );			
			process.exit(1);			
		}
	}
	
	//等待任务结束
	var nbuild = await wait_build_finish(build);
	if(!nbuild){
		var url = "https://ci.appveyor.com/project/" + username_ + "/"+ projname_ + "builds/" + build.buildId;	
		console.log("Error, ci build failed");
		console.log("please see ");
		console.log(url);
		process.exit(1);
	}
	
	//下载任务附件
	var jobid = build.jobs[0].jobId;
	var fileurl = "https://ci.appveyor.com/api/buildjobs/" + jobid + "/artifacts/file.bin";
	await download_file(fileurl, file_);
	return true;
}


//parse argv
process.argv.forEach((val, index) => {
	if(index>=2){
		if(val.charAt(0) == '-'){ //option
			if(val == "--help" || val == "-h"){
				do_help();
			}else if(val == "--setup" || val == "-s"){
				do_setup();
			}else{
				do_error_opt(val);
			}
		}else{
			if(!url_.length){
				url_ = val;
			}else{
				file_ = val;
			}
		}
	}
});


if(url_.length && file_.length){
	do_download();
}else{
	do_help();
}



