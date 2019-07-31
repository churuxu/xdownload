# xdownload
翻墙下载工具

# 适用场景
- 文件下载URL需要翻墙
- 文件下载太慢或经常中途出错（如github的Release）

# 用法说明
```xdownload <url> <file>```

# 安装说明
0. 本地电脑安装nodejs、git
1. fork这个库
2. git clone你自己fork后的库
3. 将本地这个库目录添加到PATH环境变量
4. 配置git保存密码或ssh方式，达到git push不用输入密码的效果
5. 在appveyor.com上建立project
6. 建立config.json文件，配置你自己的用户名和项目名，内容例如
```{"username":"churuxu","project":"xdownload"}```

# 实现原理
1. 下载url命令写入本地文件
2. 提交变更到github，触发appveyor上自动构建
3. appveyor上进行下载文件，并保存附件
4. 从appveyor上下载附件




