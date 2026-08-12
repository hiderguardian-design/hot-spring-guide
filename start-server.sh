#!/bin/bash
# 湾区温泉大全 - 本地预览服务器
# 用法: ./start-server.sh [端口]  (默认 8000)
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo "🌋 湾区温泉大全 预览服务器: http://localhost:${PORT}"
echo "   手机同局域网访问: http://<本机IP>:${PORT}"
python3 -m http.server "$PORT"
