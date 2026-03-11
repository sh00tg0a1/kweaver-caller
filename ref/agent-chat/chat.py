#!/usr/bin/env python3
"""
Agent Chat 对话工具

用法:
    python chat.py --query "你好"
    python chat.py --query "继续" --history '[{"role": "user", "content": "问题"}, {"role": "assistant", "content": "回答"}]'
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("错误: 请安装 PyYAML: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    print("错误: 请安装 requests: pip install requests", file=sys.stderr)
    sys.exit(1)


def find_config_file() -> Path | None:
    """查找配置文件，按优先级搜索"""
    script_dir = Path(__file__).parent.parent
    skills_dir = script_dir.parent
    
    search_paths = [
        skills_dir / "config.yaml",
        Path.cwd() / ".cursor" / "skills" / "config.yaml",
        script_dir / "chat-config.yaml",
        Path.cwd() / "chat-config.yaml",
    ]
    
    for path in search_paths:
        if path.exists():
            return path
    return None


def load_config() -> dict:
    """加载配置"""
    config_path = find_config_file()
    
    if config_path:
        with open(config_path, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f) or {}
        
        if "agent_chat" in raw_config:
            config = raw_config.get("agent_chat", {})
            common = raw_config.get("common", {})
            if common.get("token"):
                config["token"] = common["token"]
        else:
            config = raw_config
    else:
        config = {}
        print("警告: 未找到配置文件", file=sys.stderr)
    
    return config


def call_agent_chat(config: dict, query: str, history: list | None = None) -> dict:
    """调用 Agent Chat API"""
    api_config = config.get("api", {})
    url = api_config.get("url", "")
    
    if not url:
        raise ValueError("API URL 未配置")
    
    # 构建请求体
    body = {
        "agent_key": config.get("agent_key", ""),
        "agent_version": config.get("agent_version", "v1"),
        "history": history or [],
        "query": query,
        "stream": api_config.get("stream", False),
    }
    
    # 构建请求头
    headers = {
        "Content-Type": "application/json",
        "accept": "application/json",
    }
    
    # 添加配置的 headers
    custom_headers = api_config.get("headers", {})
    headers.update(custom_headers)
    
    # 添加 token
    token = config.get("token")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    timeout = api_config.get("timeout", 120)
    
    try:
        print(f"调用 Agent Chat: {url} (timeout={timeout}s)", file=sys.stderr)
        response = requests.post(
            url,
            json=body,
            headers=headers,
            timeout=timeout,
        )
        print(f"HTTP 状态码: {response.status_code}", file=sys.stderr)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        raise TimeoutError(f"请求超时 ({timeout}秒)")
    except requests.exceptions.HTTPError as e:
        error_detail = ""
        try:
            error_detail = response.text
        except:
            pass
        raise RuntimeError(f"HTTP 错误: {e}\n{error_detail}")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"请求失败: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Agent Chat 对话工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--query", "-q",
        required=True,
        help="用户问题",
    )
    parser.add_argument(
        "--history", "-H",
        default=None,
        help="历史对话记录 (JSON 格式)",
    )
    parser.add_argument(
        "--config", "-c",
        default=None,
        help="配置文件路径（可选）",
    )
    parser.add_argument(
        "--pretty", "-p",
        action="store_true",
        help="格式化输出 JSON",
    )
    
    args = parser.parse_args()
    
    # 加载配置
    if args.config:
        config_path = Path(args.config)
        if not config_path.exists():
            print(f"错误: 配置文件不存在: {args.config}", file=sys.stderr)
            sys.exit(1)
        with open(config_path, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f) or {}
        config = raw_config.get("agent_chat", raw_config)
        common = raw_config.get("common", {})
        if common.get("token"):
            config["token"] = common["token"]
    else:
        config = load_config()
    
    # 解析 history
    history = None
    if args.history:
        try:
            history = json.loads(args.history)
        except json.JSONDecodeError as e:
            print(f"错误: history 格式无效: {e}", file=sys.stderr)
            sys.exit(1)
    
    try:
        result = call_agent_chat(
            config,
            query=args.query,
            history=history,
        )
        
        if args.pretty:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(result, ensure_ascii=False))
            
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
