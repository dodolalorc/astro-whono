---
title: ?? �ҵ� mac �����ֲ�
description: "HomeBrew HomeBrew ��һ����������ߣ�֧��"
tags:
  - Mac
  - Git
  - HomeBrew
  - Item2
  - zsh
  - oh-my-zsh
date: 2025-08-01
lastmod: 2025-08-05
draft: false
categories:
series:
hiddenFromHomePage: false
hiddenFromSearch: false
toc:
  enable: true
math:
  enable: true
lightgallery: false
license: ""
---

# HomeBrew

`HomeBrew`��һ����������ߣ�֧�� Mac OS �� Linux ϵͳ�����Ȱ�װ�� HomeBrew ���Է������ǻ�ȡ��������Ҫ��������

�������ʣ�[Homebrew](https://brew.sh/)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## ��Դ

��������İ�װ�ű�����ʧ�ܣ����Գ��Ի�Դ�����廪ԴΪ������

```bash
export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"
export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"
export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/bottles"

/bin/bash -c "$(curl -fsSL https://gitee.com/ineo6/homebrew-install/raw/master/install.sh)"
```

����ѡ������������ѯ��[��������](https://brew.idayer.com/guide/change-source/)

## ����

```bash
brew update
```

# oh-my-zsh

oh-my-zsh �� zsh ����չ���߼�����װ oh-my-zsh ��ǰ�������ǰ�װʹ�� zsh��

## zsh

��ѯ`zsh`�汾��`zsh --version`

�г������նˣ�

```bash
cat /etc/shells
```

��ǰʹ�õ��նˣ�

```bash
echo $SHELL
```

��Ĭ���ն����ó�`zsh`����������Ҫ������Ч��

```bash
chsh -s /bin/zsh
```

## ��װ oh-my-zsh

������[oh-my-zsh](https://ohmyz.sh/#install)���ṩ��`curl`��`wget`���ַ�ʽ��

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
sh -c "$(wget https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh -O -)"
```

## ��������

��װ�ɹ��󣬴������ļ����������⣺

```bash
# ���±���
open ~/.zshrc
# vim��
vim ~/.zshrc
```

��ʾ���ݣ�

```bash showLineNumbers warp {11}
# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:$HOME/.local/bin:/usr/local/bin:$PATH

# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time Oh My Zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="robbyrussell"

......
```

����`ZSH_THEME="robbyrussell"`����������ģ������ڣ�[ohmyzsh/ohmyzsh/wiki/Themes](https://github.com/ohmyzsh/ohmyzsh/wiki/Themes)�鿴���������Ч������ѡ��ʹ�õ������������������������ɡ�

### �ַ�֧��

��һЩ��������������ַ����� GitHub ���ز���װ��

```bash
git clone https://github.com/powerline/fonts.git --depth=1

cd fonts
./install.sh

cd ..
rm -rf fonts
```

## oh-my-zsh ���

����Ư�������⣬oh-my-zsh ��ӵ�зḻ�Ĳ��ϵͳ��[ohmyzsh/ohmyzsh/wiki/plugins](https://github.com/ohmyzsh/ohmyzsh/wiki/plugins)

���Ǵ�`~/.zshrc`�����������������ݣ�

```bash showLineNumbers warp {9}
# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git)
```

Ĭ���ڰ�װʱ�Ѿ��䱸�� git �ı�����������г��õı�����������ƪ�в鿴��[git ���ñ���](/04-tools/git-settings#5-���ñ���)��

�ڲ��ϵͳ����ѡϲ���Ĳ�����Ƽ��Ĳ���У�

### �����и�������ȫ

��Դ��[Oh my ZSH with zsh-autosuggestions zsh-syntax-highlighting zsh-fast-syntax-highlighting and zsh-autocomplete.md](https://gist.github.com/n1snt/454b879b8f0b7995740ae04c5fb5b7df)

��װ���²����

- autosuggesions plugin
  - `git clone https://github.com/zsh-users/zsh-autosuggestions.git $ZSH_CUSTOM/plugins/zsh-autosuggestions`
- zsh-syntax-highlighting plugin
  - `git clone https://github.com/zsh-users/zsh-syntax-highlighting.git $ZSH_CUSTOM/plugins/zsh-syntax-highlighting`
- zsh-fast-syntax-highlighting plugin
  - `git clone https://github.com/zdharma-continuum/fast-syntax-highlighting.git ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/fast-syntax-highlighting`
- zsh-autocomplete plugin
  - `git clone --depth 1 -- https://github.com/marlonrichert/zsh-autocomplete.git $ZSH_CUSTOM/plugins/zsh-autocomplete`

�������ļ���ʹ�ã�

```bash
plugins=(git zsh-autosuggestions zsh-syntax-highlighting fast-syntax-highlighting zsh-autocomplete)
```

> ����ʵ��ʹ�õ�ʱ����˻���ϲ��ȥ��`zsh-autosuggestions`��ֻʹ�ò�ȫ
### �����Ƽ�

- [z](https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/z)����¼��ʷ·�����ṩ������ת��ʹ��`z`��`z p`��
- [copypath](https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/copypath)�����Ƶ�ǰ��·�������а塣ʹ�ã�`copypath <�ļ���Ŀ¼>`�����Ӳ������Ǹ��Ƶ�ǰ·�������`pwd`�ٹ��ѡ�и���ݡ�
- [copyfile](https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/copyfile)�������ļ����ݵ����а塣ʹ�ã�`copyfile filename.txt`�����ɽ��ļ������ݸ��ƣ�ʡ�Դ��ļ��ĺ�ȫѡ���ƵĲ��衣

# iTerm2

## ��װ

```bash
brew install --cask iterm2
```

## ��������

1. `command ,`���� settings �˵���
2. `Profiles`->`colors`->`color Presets`��ѡ����ɫ�����⡢����΢����
3. ������ɫ���⣺[Iterm2-color-schemes](https://iterm2colorschemes.com/)
4. ��ѡϲ������������ض�Ӧ���ļ���
5. �ڵ� 2 ����`color Presets`��ѡ��`import`��ѡ�����ص������ļ�����׺`.itermcolors`��
6. �ٴδ�`color Presets`�ͻᷢ�������Ѿ����أ����ʹ�ü��ɡ�

ddl ϲ�������⣺[tokyonight](https://raw.githubusercontent.com/mbadolato/iTerm2-Color-Schemes/master/schemes/tokyonight.itermcolors)

��� item2 �����ڳ������Ϸ���ʹ�ü��ɡ�

# Xcode-select ��װ�����й���

�ڰ�װ Homebrew ʱ��Ҳ�ḽ������ Xcode �����й��ߣ����û�а�װ Xcode �����й��ߣ��������У�

```bash
xcode-select --install
```

����һ���������Ĺ��߰���������������Ļ��������й��ߣ�������Ҫ��װ������ Xcode����ʡ�ռ䣬Լ 1-2GB��

> [!abstract]- �����о�
>
> - ���ı��빤��
>   - `clangd`��xcode Ĭ�ϱ�����
>   - `swift`��`swiftc`��swift ���Ա�����
>   - `ld`������������`ar`����̬�������ߣ�
>   - `make`��`cmake`����Ŀ��������
> - �������������
>   - `lldb`��xcode �������������а汾
> - �汾���ƹ���
>   - **`git`**������汾�������ߣ�macOS �Դ� ?`git`? ���汾�Ͼɣ�CLT ����µ����°棩��
>   - **`svn`**��Subversion �汾���ƹ��ߡ�
> - �ĵ�����
>   - `header` �ļ���C/C++ ��׼�⡢ϵͳ��ܵ�ͷ�ļ����� ?`stdio.h`��`Foundation.framework`��
>   - `man`�ĵ��������й��ߵ��ֲ�ҳ���� ?`man clang`����
> - ����ʵ�ù���
>   - `xcrun`��Xcode �������ĵ���������ڵ����������ߣ���
>   - `sdkmanager`������ SDK ·������ ?`xcrun --show-sdk-path`����
>   - `pkgutil`���������������ߡ�

������Ҳ��[?? ���� xcode ʹ������](/04-tools/xcode-commands)����Ȥ��

# Git ��������

Mac ϵͳ�Դ��� Git�������ڰ�װ XCode ʱ��Ҳ�Ѿ���װ�� Git��

���Բο������»�ø���ϸ�����ã�[??Git �������ú� SSH ��Կ����](/04-tools/git-settings)

# Mac �ϸ� VS code ���������д�Ŀ¼

[VS code ����](https://code.visualstudio.com/)

1. �� VS code��`shift + command + p`�����������
2. ����`shell Command`��ѡ��`��PATH�а�װcode����`
3. ���������ȷ�ϲ���
