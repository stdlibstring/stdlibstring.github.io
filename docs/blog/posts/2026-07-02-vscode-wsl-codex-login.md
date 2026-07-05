---
date: 2026-07-02
categories:
  - 排错记录
tags:
  - WSL
  - Ubuntu 24.04
  - VS Code
  - Remote WSL
  - Codex
  - Windows Proxy
  - localhost
  - 403
  - networkingMode
  - autoProxy
---

# VS Code + WSL 中 Codex 登录失败：从远程扩展环境到代理出口排查

最近我在 Windows 上重新整理 WSL 开发环境，并尝试在 VS Code 里使用 Codex 扩展。表面问题是 Codex 登录失败，错误信息里出现了 `403 Forbidden` 和 `Country, region, or territory not supported`；但排查下来，关键点并不只在 Codex 本身，而是在 **VS Code Remote-WSL、WSL 网络模式、Windows 本地代理和 localhost 语义差异** 之间。

这篇文章记录完整排查过程，也顺手整理几个容易混淆的概念。

<!-- more -->

## 环境

当时我的环境大概是：

```text
Windows
PowerShell / pwsh
WSL 2
Ubuntu-22.04
Ubuntu-24.04
VS Code
Remote - WSL
Codex 扩展
```

WSL 中有多个发行版：

```powershell
wsl -l -v
```

输出类似：

```text
  NAME              STATE           VERSION
* Ubuntu-22.04      Stopped         2
  Ubuntu            Stopped         2
  Ubuntu-24.04      Stopped         2
  docker-desktop    Stopped         2
```

其中 `Ubuntu-22.04` 是默认发行版，`Ubuntu-24.04` 是我新装的环境。我希望在 `Ubuntu-24.04` 中使用 VS Code 和 Codex。

## 先确认：当前到底在哪个 Linux 环境里

安装 Ubuntu-24.04 时，我用的是：

```powershell
wsl --install -d Ubuntu-24.04
```

初始化时，WSL 会要求创建一个默认 Linux 用户：

```text
Create a default Unix user account:
```

这里创建的是 **当前 WSL 发行版内部的 Linux 用户**，不是 Windows 用户。不同发行版之间的用户、密码、home 目录和配置文件都是相互独立的。

例如：

```text
Ubuntu-22.04 里可以有 lucas
Ubuntu-24.04 里也可以有 lucas
Ubuntu 里也可以有 lucas 或 root
```

这些用户名可以相同，但它们属于不同的 Linux 系统实例。

我进入 WSL 后看到过类似提示：

```bash
lucas@wind:/mnt/c/Users/22380$
```

这说明我虽然已经在 WSL 中，但当前目录仍然是 Windows C 盘的挂载路径：

```bash
/mnt/c/Users/22380
```

而 WSL 自己的 Linux home 目录一般是：

```bash
/home/lucas
```

可以用下面的命令确认：

```bash
cd ~
pwd
```

这个区别很重要：开发项目最好放在 WSL 自己的 Linux 文件系统里，例如 `~/code/project-name`，而不是长期放在 `/mnt/c/...` 下面。这样权限、文件监听和性能都会更接近正常 Linux 开发环境。

## 顺手确认：WSL 的磁盘空间在哪里

WSL 2 的 Linux 文件系统实际存放在一个虚拟磁盘文件里，通常叫：

```text
ext4.vhdx
```

可以在 PowerShell 里查询某个发行版的路径：

```powershell
(Get-ChildItem -Path HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss | Where-Object { $_.GetValue("DistributionName") -eq 'Ubuntu-24.04' }).GetValue("BasePath") + "\ext4.vhdx"
```

输出类似：

```text
C:\Users\22380\AppData\Local\wsl\{...}\ext4.vhdx
```

这说明 `Ubuntu-24.04` 的 Linux 文件系统实际占用的是 C 盘空间。

如果希望把新发行版装到其他盘，可以在安装时指定位置：

```powershell
wsl --install -d Ubuntu-24.04 --location E:\WSL\Ubuntu-24.04
```

如果已经装好了，也可以通过 `wsl --export` 和 `wsl --import` 迁移。刚装完、还没重要数据时，也可以注销旧实例后重新安装：

```powershell
wsl --unregister Ubuntu-24.04
```

注意：`wsl --unregister` 会永久删除该发行版里的所有数据，不是放进回收站。

## Remote-SSH 和 Remote-WSL 不是一回事

我一开始还检查了以前的 SSH 配置，里面有类似内容：

```sshconfig
Host wsl
  HostName 172.18.0.171
  User lucas
```

也有：

```sshconfig
Host 172.18.0.171
  HostName 172.18.0.171
  User lucas
```

这两个配置从连接结果看差不多，都是通过 SSH 连接到某个 WSL IP：

```text
lucas@172.18.0.171
```

但这是 **Remote-SSH** 的思路。

后来我确认，VS Code 当前窗口其实是通过 **Remote-WSL** 连接到 `Ubuntu-24.04`。左下角显示的是：

```text
WSL: Ubuntu-24.04
```

这说明当前 VS Code 窗口不是通过 SSH 连接进去的，而是通过 VS Code 的 WSL 扩展直接连接到了指定发行版。

可以简单理解为：

```text
Remote-SSH 看 IP、端口、用户名。
Remote-WSL 看 WSL 发行版名。
```

如果使用 Remote-WSL，通常不需要关心：

```text
172.18.x.x
22 端口
ssh config
sshd 服务
```

直接在 WSL 里执行：

```bash
code .
```

或者在 VS Code 命令面板中选择：

```text
WSL: Connect to WSL using Distro...
```

然后选择：

```text
Ubuntu-24.04
```

即可。

## Codex 扩展要装在当前远程环境里

打开 VS Code 后，我看到 Codex 扩展页面提示：

```text
此扩展在此工作区中被禁用，因为其被定义为在远程扩展主机中运行。
请在 'WSL: Ubuntu-24.04' 中安装扩展以进行启用。
```

这句话的意思是：Codex 扩展虽然可能已经装在 Windows 本地 VS Code 里，但当前窗口运行在 WSL 远程环境中，所以还需要把扩展安装到 `WSL: Ubuntu-24.04` 这个远程环境里。

VS Code 的扩展在远程模式下会分成两类：

```text
Windows 本地扩展
WSL 远程扩展
```

像主题、图标这类只影响 UI 的扩展可以在本地运行；但 Codex 这类需要读取项目文件、执行命令、修改代码的扩展，应该安装在项目所在的远程环境中。

所以这里应该点击：

```text
在 WSL: Ubuntu-24.04 中安装
```

而不是卸载扩展。

## 登录失败现象

安装 Codex 后，我尝试登录。浏览器打开了本地回调地址：

```text
localhost:1455/auth/callback?code=...
```

但页面提示：

```text
Sign-in could not be completed

Token exchange failed: token endpoint returned status 403 Forbidden:
Country, region, or territory not supported
```

这类错误表面上是地区或网络出口问题。需要注意的是：如果服务本身对当前地区不可用，应遵守服务的可用范围；这篇文章记录的是我在自己的环境里排查到的另一层问题：**浏览器和运行在 WSL 中的 Codex 扩展没有走同一个网络出口**。

当时 WSL 还反复提示：

```text
wsl: 检测到 localhost 代理配置，但未镜像到 WSL。
NAT 模式下的 WSL 不支持 localhost 代理。
```

这条提示给了关键线索。

## 关键判断：Windows 的 localhost 不等于 WSL 的 localhost

Windows 上的代理常见写法是：

```text
127.0.0.1:7890
localhost:7890
```

但在 WSL 默认 NAT 模式下：

```text
Windows 的 localhost != WSL 的 localhost
```

Windows 里的 `127.0.0.1` 指的是 Windows 自己；WSL 里的 `127.0.0.1` 指的是 WSL 自己。

所以问题可能变成：

```text
浏览器运行在 Windows 中，可以使用 Windows 的 localhost 代理；
Codex 扩展运行在 WSL 中，未必能正确使用 Windows 的 localhost 代理；
登录回调能打开，但 token exchange 阶段的网络出口可能不一致。
```

这解释了为什么错误看起来像 Codex 登录失败，但真正需要检查的是 WSL 网络模式和代理继承。

## 解决方案：修改 `.wslconfig`

我在 PowerShell 中打开 Windows 用户目录下的 `.wslconfig`：

```powershell
notepad $env:USERPROFILE\.wslconfig
```

注意，`$env:USERPROFILE` 是 PowerShell 的环境变量写法，不是 Bash 的写法。

如果在 WSL Bash 里执行：

```bash
echo $env:USERPROFILE
```

结果会很奇怪，因为 Bash 会把它理解成 `$env` 加上字符串 `:USERPROFILE`。在 WSL 里查看当前 Linux 用户目录，应使用：

```bash
echo $HOME
```

或者：

```bash
pwd
```

我的 `.wslconfig` 最终写成：

```ini
[wsl2]
networkingMode=mirrored
autoProxy=true
```

保存后，在 PowerShell 中关闭所有 WSL 实例：

```powershell
wsl --shutdown
```

然后重新打开 VS Code 的 `WSL: Ubuntu-24.04` 窗口，再登录 Codex，问题解决。

## 这两个配置分别做什么

### `networkingMode=mirrored`

这个配置会让 WSL 使用镜像网络模式。简单理解就是：WSL 的网络行为会更接近 Windows 主机网络，而不是完全待在默认 NAT 虚拟网络里。

它对这类问题的帮助是：

```text
WSL 访问 Windows localhost 服务更加自然。
```

也就是说，Windows 上的本地代理、开发服务和部分网络配置，更容易被 WSL 正确使用。

### `autoProxy=true`

这个配置会让 WSL 使用 Windows 的 HTTP 代理信息。

如果 Windows 中已经配置了代理，WSL 会尝试继承这套代理设置。这样 Codex 扩展运行在 WSL 中时，更可能和 Windows 浏览器使用一致的网络出口。

如果配置没有生效，可以先检查 WSL 版本：

```powershell
wsl --version
wsl --status
```

必要时更新 WSL：

```powershell
wsl --update
```

## 可能的副作用

这两个配置不是只影响 Codex，而是影响整个 WSL 2 虚拟机。

也就是说，下面这些发行版或环境都可能受到影响：

```text
Ubuntu-22.04
Ubuntu-24.04
Ubuntu
docker-desktop
```

可能的正面影响：

```text
WSL 访问网络更像 Windows
WSL 更容易使用 Windows 代理
GitHub、npm、pip、apt 等网络请求可能更稳定
localhost 互通更自然
```

可能的副作用：

```text
以前依赖 NAT IP 的配置可能变化
SSH config 里写死的 172.18.x.x 可能失效
Windows 代理异常时，WSL 网络也可能跟着异常
Docker Desktop 或其他 WSL 发行版的网络行为可能变化
```

如果以后要回滚，可以把 `.wslconfig` 改成：

```ini
[wsl2]
# networkingMode=mirrored
# autoProxy=true
```

然后重新关闭 WSL：

```powershell
wsl --shutdown
```

## 插曲：VS Code Server 连接异常

排查过程中，我还遇到过 VS Code 报错：

```text
无法获取远程环境
无法连接到远程扩展主机服务器
WebSocket close with status code 1006
```

这通常和 WSL 中的 VS Code Server 状态有关。

可以尝试在 WSL 中删除 VS Code Server，让 VS Code 下次连接时自动重装：

```bash
rm -rf ~/.vscode-server
rm -rf ~/.vscode-server-insiders
```

这会删除 VS Code 在 WSL 里的远程服务缓存，不会删除项目代码。

然后在 PowerShell 中终止目标发行版：

```powershell
wsl --terminate Ubuntu-24.04
```

重新进入：

```powershell
wsl -d Ubuntu-24.04
```

再打开项目：

```bash
code .
```

## 复盘

这次问题的根因不是 VS Code 没装好，也不是 Ubuntu-24.04 本身有问题，而是：

```text
Codex 扩展运行在 WSL 中；
WSL 默认 NAT 网络模式下不能直接复用 Windows 的 localhost 代理；
浏览器和 Codex 扩展的网络出口可能不一致；
最终导致登录时 token exchange 阶段失败。
```

最终生效的配置是：

```ini
[wsl2]
networkingMode=mirrored
autoProxy=true
```

并执行：

```powershell
wsl --shutdown
```

这类问题很典型：表面上是某个扩展登录失败，实际牵扯到运行环境、远程扩展主机、代理配置和 localhost 语义差异。

以后再遇到类似问题，我会先问自己四个问题：

```text
1. 当前 VS Code 窗口运行在 Windows、本机 WSL，还是远程服务器？
2. 这个扩展到底安装在本地，还是安装在远程环境？
3. 浏览器和扩展进程走的是不是同一个网络出口？
4. 配置里的 localhost 指向的是 Windows，还是 WSL 自己？
```

把这几层拆开看，问题会清楚很多。

## 参考资料

- [Microsoft Learn: Advanced settings configuration in WSL](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [Microsoft Learn: Basic commands for WSL](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)
- [VS Code Docs: Developing in WSL](https://code.visualstudio.com/docs/remote/wsl)
