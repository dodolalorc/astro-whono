---
title: "友链制作"
description: "这篇文章原本使用了 Rspress 的 Tabs 组件和自定义 FriendLink 组件。迁移到 Astro 主题后，这些 MDX 组件无法直接渲染，所以这里改成普通 Markdown，保留实现思路、示例结构和核心代码。"
date: 2025-08-27
tags: []
draft: false
badge: "项目"
---
这篇文章原本使用了 Rspress 的 `Tabs` 组件和自定义 `FriendLink` 组件。迁移到 Astro 主题后，这些 MDX 组件无法直接渲染，所以这里改成普通 Markdown，保留实现思路、示例结构和核心代码。

## 使用场景

适合在博客中展示友链卡片，信息项包括站点名称、链接、头像和一句简短介绍。

示例数据：

```tsx
<div className="friend-link-shell">
  <FriendLink
    name="dodola"
    url="https://dodolalorc.cn/"
    avatar="https://dodolalorc.cn/img/dodola.png"
    bio="要是人生能像星露谷就好了。"
  />
  <FriendLink
    name="dodola"
    url="https://dodolalorc.github.io/"
    avatar="https://dodolalorc.cn/img/dodola.png"
    bio="要是人生能像星露谷就好了。"
  />
</div>
```

## React 组件实现

```tsx
import type React from "react";
import "./FriendLink.css";

interface FriendProps {
  name: string;
  url: string;
  avatar: string;
  bio: string;
}

const getRandomBackgroundColor = () => {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgba(${r}, ${g}, ${b}, 0.5)`;
};

const fallbackAvatar = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const target = event.target as HTMLImageElement;
  target.onerror = null;
  target.src = "/momo.png";
};

const FriendLink: React.FC<FriendProps> = ({ name, url, avatar, bio }) => {
  return (
    <a
      target="_blank"
      href={url}
      title={name}
      className="friend-link"
      style={{
        backgroundColor: getRandomBackgroundColor(),
        textDecoration: "none",
        color: "inherit",
      }}
      rel="noopener noreferrer"
    >
      <div className="friend-link-div">
        <div className="friend-link-avatar">
          <img
            src={avatar}
            alt={`${name}'s avatar`}
            onError={(event) => fallbackAvatar(event)}
          />
        </div>

        <div className="friend-link-info">
          <div className="friend-name-div">
            <span className="friend-name">{name}</span>
            <i className="i-hugeicons-cursor-magic-selection-02 px-3" />
          </div>
          <p className="friend-bio">{bio}</p>
        </div>
      </div>
    </a>
  );
};

export default FriendLink;
```

## CSS 样式

```css
.friend-link-shell {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  width: 100%;
  gap: 10px;
}

.friend-link {
  align-items: center;
  border-radius: 20px;
  padding: 10px 20px;
}

.friend-link:hover {
  transform: scale(1.1);
  transition: transform 0.3s ease-in-out;
}

.friend-link-div {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  justify-content: center;
  align-items: center;
  margin: 10px;
}

.friend-link-avatar {
  grid-column: span 1;
  margin: 0 14px;
  position: relative;
  width: 80%;
  height: 0;
  padding-top: 80%;
}

.friend-link-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: absolute;
  top: 0;
  left: 0;
  border: 2px solid white;
}

.friend-link-info {
  grid-column: span 4;
  margin: 0 10px;
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.friend-name-div {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.friend-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.friend-bio {
  font-size: 14px;
  color: #666;
}
```
