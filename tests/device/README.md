# 真机验收脚本

用 adb 驱动的黑盒检查，覆盖客户端那八条 P1 场景里能自动化判定的部分。

```bash
export ADB=adb                 # 或指向你自己的 adb
APK=~/Downloads/tft-kimi-assistant-v1.2.5.apk ./run.sh
./run.sh t03 t07               # 只跑指定几项
```

| 脚本 | 验什么 | 判定 |
|---|---|---|
| `t01_launch_and_serve.sh` | 启动、进程、本地服务首页与 manifest | 都 200 且无崩溃记录 |
| `t02_offline_start.sh` | 关掉 WiFi/数据后仍能启动并读包内快照 | manifest 仍 200 |
| `t03_assets_webp.sh` | `.png` 回落 `.webp`，真 PNG 不受影响 | 前三项 content-type 正确 |
| `t04_port_rebind.sh` | 连续两次启动都能拿到端口并服务 | 第二次仍 200 |
| `t05_permissions.sh` | 悬浮窗与通知权限的实际状态 | 只记录，不判失败 |
| `t07_update_check.sh` | 启动自检是否留下 `KimiUpdate` 日志 | 15 秒内出现一行 |

## 不能自动化的部分

- **同步期 overlay 一致性**、**包内快照新于缓存**：要构造特定数据版本，属于集成测试，建议在模拟器上配假数据跑。
- **原生浮窗与通知的实际显示**：需要人眼确认，脚本只能查权限位。
- **版本比较拒绝降级**：纯逻辑，`tests/` 里的 node 测试已覆盖同类语义。

脚本只读设备状态，唯一会改设备的是 `t02` 的开关网络（结束时会恢复）和 `APK=` 时的安装。
