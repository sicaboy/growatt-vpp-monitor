#!/usr/bin/env python3
"""
测试脚本：扫描 Growatt 逆变器寄存器，查找 grid import 数据
目标：找到官网显示 5.54kW grid import 对应的寄存器

使用方法：
    python test_grid_registers.py --ip 192.168.9.242
"""

import time
import argparse
from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusIOException, ConnectionException

# 默认配置
DEFAULT_IP = "192.168.9.242"
DEFAULT_PORT = 502
DEFAULT_UNIT_ID = 1

RETRY_TIMEOUT_SEC = 5
RETRY_DELAY_SEC = 0.3


def robust_read_input_registers(client, addr, count, unit_id):
    """读取 input registers (FC04) with retry"""
    start = time.time()
    while True:
        if not client.connected:
            try:
                client.connect()
            except Exception:
                pass
        try:
            rr = client.read_input_registers(address=addr, count=count, unit=unit_id)
            if (not isinstance(rr, ModbusIOException)) and (not rr.isError()):
                return rr.registers
        except (ConnectionException, OSError, Exception):
            pass
        if time.time() - start > RETRY_TIMEOUT_SEC:
            return None
        time.sleep(RETRY_DELAY_SEC)


def read_u16(client, addr, unit_id):
    regs = robust_read_input_registers(client, addr, 1, unit_id)
    return None if regs is None else regs[0]


def read_u32(client, addr, unit_id):
    regs = robust_read_input_registers(client, addr, 2, unit_id)
    if regs is None:
        return None
    hi, lo = regs
    return (hi << 16) | lo


def read_s32(client, addr, unit_id):
    val = read_u32(client, addr, unit_id)
    if val is None:
        return None
    if val & 0x80000000:
        val -= 0x100000000
    return val


def format_power(raw, divisor=10):
    """将原始值转换为 kW 显示"""
    if raw is None:
        return "None"
    watts = raw / divisor
    kw = watts / 1000
    return f"{raw} (raw) = {watts:.1f}W = {kw:.3f}kW"


def format_kw(raw, divisor=10):
    """简洁格式：只返回 kW 值"""
    if raw is None:
        return "None"
    return f"{raw / divisor / 1000:.3f}"


def run_monitor_mode(args):
    """
    连续监控模式：每隔 N 秒输出一次关键寄存器值
    方便与官网数据对比（官网有5分钟延迟）
    
    使用方法：
    1. 运行脚本进入监控模式
    2. 等待官网数据更新
    3. 找到官网显示的时间点对应的本地记录
    4. 对比哪个寄存器值匹配
    """
    from datetime import datetime
    import csv
    
    client = ModbusTcpClient(args.ip, port=args.port)
    client.connect()
    
    # 创建 CSV 日志文件
    log_filename = f"grid_monitor_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    print("=" * 120)
    print(f"📡 连续监控模式 - 每 {args.interval} 秒刷新")
    print(f"   连接: {args.ip}:{args.port}")
    print(f"   日志文件: {log_filename}")
    print("=" * 120)
    print()
    print("使用方法:")
    print("  1. 保持脚本运行至少 5-10 分钟")
    print("  2. 等官网数据更新后，记下官网显示的时间和 Grid Import 值")
    print("  3. 在日志中找到对应时间点的记录")
    print("  4. 按 Ctrl+C 退出")
    print()
    
    # CSV 字段
    csv_fields = [
        'time', 'pv', 'load', 'soc',
        '1021_hi_lo', '1021_lo_hi', '1021_raw_hi', '1021_raw_lo',
        '1029_s32', '1029_u32',
        '1009_hi_lo', '1009_lo_hi',  # battery discharge
        '1015_hi_lo', '1015_lo_hi',  # AC power to user
        '1037_hi_lo', '1037_lo_hi',  # total power to load
        'current_code_import'
    ]
    
    # 写入 CSV 头
    with open(log_filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
    
    print("-" * 120)
    print(f"{'时间':^10} | {'PV':^7} | {'Load':^7} | {'SOC':^5} | "
          f"{'1021 hi|lo':^10} | {'1021 lo|hi':^10} | "
          f"{'1029 s32':^10} | {'1009':^10} | {'当前代码':^10}")
    print("-" * 120)
    
    try:
        while True:
            now = datetime.now()
            time_str = now.strftime("%H:%M:%S")
            
            # 读取基础数据
            pv_raw = read_u32(client, 1, args.unit)
            load_raw = read_s32(client, 1037, args.unit)
            soc_bms = read_u16(client, 1086, args.unit)
            
            # 读取 1021 的原始寄存器值 (两个 16 位)
            regs_1021 = robust_read_input_registers(client, 1021, 2, args.unit)
            if regs_1021:
                r1021_hi, r1021_lo = regs_1021[0], regs_1021[1]
                r1021_hi_lo = (r1021_hi << 16) | r1021_lo
                r1021_lo_hi = (r1021_lo << 16) | r1021_hi
            else:
                r1021_hi, r1021_lo = None, None
                r1021_hi_lo, r1021_lo_hi = None, None
            
            # 读取 1029 (当前代码使用的)
            r1029_s32 = read_s32(client, 1029, args.unit)
            r1029_u32 = read_u32(client, 1029, args.unit)
            
            # 读取 1009 (battery discharge)
            regs_1009 = robust_read_input_registers(client, 1009, 2, args.unit)
            if regs_1009:
                r1009_hi_lo = (regs_1009[0] << 16) | regs_1009[1]
                r1009_lo_hi = (regs_1009[1] << 16) | regs_1009[0]
            else:
                r1009_hi_lo, r1009_lo_hi = None, None
            
            # 读取 1015 (AC power to user)
            regs_1015 = robust_read_input_registers(client, 1015, 2, args.unit)
            if regs_1015:
                r1015_hi_lo = (regs_1015[0] << 16) | regs_1015[1]
                r1015_lo_hi = (regs_1015[1] << 16) | regs_1015[0]
            else:
                r1015_hi_lo, r1015_lo_hi = None, None
                
            # 读取 1037 (total power to load) 的原始值
            regs_1037 = robust_read_input_registers(client, 1037, 2, args.unit)
            if regs_1037:
                r1037_hi_lo = (regs_1037[0] << 16) | regs_1037[1]
                r1037_lo_hi = (regs_1037[1] << 16) | regs_1037[0]
            else:
                r1037_hi_lo, r1037_lo_hi = None, None
            
            # 当前代码计算的 grid_import
            if r1029_s32 is not None:
                grid_kw = r1029_s32 / 10.0 / 1000.0
                current_import = max(-grid_kw, 0)
                current_import_str = f"{current_import:.3f}"
            else:
                current_import_str = "None"
            
            # 转换为 kW
            pv_kw = format_kw(pv_raw) if pv_raw else "None"
            load_kw = format_kw(load_raw) if load_raw else "None"
            soc_str = f"{soc_bms}%" if soc_bms else "None"
            
            # 打印到控制台
            row = (
                f"{time_str:^10} | "
                f"{pv_kw:^7} | "
                f"{load_kw:^7} | "
                f"{soc_str:^5} | "
                f"{format_kw(r1021_hi_lo):^10} | "
                f"{format_kw(r1021_lo_hi):^10} | "
                f"{format_kw(r1029_s32):^10} | "
                f"{format_kw(r1009_hi_lo):^10} | "
                f"{current_import_str:^10}"
            )
            print(row)
            
            # 写入 CSV
            csv_row = {
                'time': now.strftime("%Y-%m-%d %H:%M:%S"),
                'pv': format_kw(pv_raw),
                'load': format_kw(load_raw),
                'soc': soc_bms,
                '1021_hi_lo': format_kw(r1021_hi_lo),
                '1021_lo_hi': format_kw(r1021_lo_hi),
                '1021_raw_hi': r1021_hi,
                '1021_raw_lo': r1021_lo,
                '1029_s32': format_kw(r1029_s32),
                '1029_u32': format_kw(r1029_u32),
                '1009_hi_lo': format_kw(r1009_hi_lo),
                '1009_lo_hi': format_kw(r1009_lo_hi),
                '1015_hi_lo': format_kw(r1015_hi_lo),
                '1015_lo_hi': format_kw(r1015_lo_hi),
                '1037_hi_lo': format_kw(r1037_hi_lo),
                '1037_lo_hi': format_kw(r1037_lo_hi),
                'current_code_import': current_import_str
            }
            with open(log_filename, 'a', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=csv_fields)
                writer.writerow(csv_row)
            
            time.sleep(args.interval)
            
    except KeyboardInterrupt:
        print()
        print("-" * 120)
        print(f"✅ 已停止监控")
        print(f"📁 数据已保存到: {log_filename}")
        print()
        print("下一步:")
        print("  1. 查看官网显示的 Grid Import 值和时间")
        print("  2. 在 CSV 文件中找到对应时间点")
        print("  3. 对比哪一列的值最接近官网")
        print("  4. 告诉我匹配的寄存器 (1021_hi_lo / 1021_lo_hi / 1029_s32 等)")
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description="扫描 Growatt 寄存器查找 grid import")
    parser.add_argument("--ip", default=DEFAULT_IP, help=f"逆变器 IP (默认: {DEFAULT_IP})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"端口 (默认: {DEFAULT_PORT})")
    parser.add_argument("--unit", type=int, default=DEFAULT_UNIT_ID, help=f"Unit ID (默认: {DEFAULT_UNIT_ID})")
    parser.add_argument("--monitor", "-m", action="store_true", help="连续监控模式（每10秒刷新）")
    parser.add_argument("--interval", "-i", type=int, default=10, help="监控间隔秒数 (默认: 10)")
    parser.add_argument("--target", "-t", type=float, default=None, help="目标 kW 值，用于匹配寄存器 (例如: 2.76)")
    parser.add_argument("--tolerance", type=float, default=0.05, help="匹配容差 kW (默认: 0.05)")
    args = parser.parse_args()
    
    if args.monitor:
        run_monitor_mode(args)
        return

    client = ModbusTcpClient(args.ip, port=args.port)
    client.connect()

    print("=" * 80)
    print(f"Growatt 寄存器扫描 - 查找 Grid Import")
    print(f"连接: {args.ip}:{args.port}, Unit ID: {args.unit}")
    print("=" * 80)
    print()

    # =========================================================================
    # 第一部分：读取你代码当前使用的寄存器
    # =========================================================================
    print("【1】当前 api_server.py 使用的寄存器:")
    print("-" * 60)
    
    pv_raw = read_u32(client, 1, args.unit)
    grid_raw = read_s32(client, 1029, args.unit)
    load_raw = read_s32(client, 1037, args.unit)
    soc_inv = read_u16(client, 1014, args.unit)
    soc_bms = read_u16(client, 1086, args.unit)

    print(f"  寄存器 1     (PV power):     {format_power(pv_raw)}")
    print(f"  寄存器 1029  (Grid, s32):    {format_power(grid_raw)}")
    print(f"  寄存器 1037  (Load, s32):    {format_power(load_raw)}")
    print(f"  寄存器 1014  (SOC inv):      {soc_inv}%")
    print(f"  寄存器 1086  (SOC BMS):      {soc_bms}%")
    
    # 计算当前代码的 grid import/export
    if grid_raw is not None:
        grid_kw = grid_raw / 10.0 / 1000.0
        grid_export = max(grid_kw, 0)
        grid_import = max(-grid_kw, 0)
        print()
        print(f"  >> 当前代码计算的 grid_export: {grid_export:.3f} kW")
        print(f"  >> 当前代码计算的 grid_import: {grid_import:.3f} kW")
    print()

    # =========================================================================
    # 第二部分：扫描可能的 Grid 相关寄存器
    # =========================================================================
    print("【2】扫描可能的 Grid 相关寄存器:")
    print("-" * 60)
    
    # 可能的 grid 寄存器地址列表
    grid_candidates = [
        (1021, "u32", "Grid (1021-1022)"),
        (1023, "u32", "Grid (1023-1024)"),
        (1025, "u32", "Grid (1025-1026)"),
        (1027, "u32", "Grid (1027-1028)"),
        (1029, "u32", "Grid (1029-1030) - 当前使用"),
        (1029, "s32", "Grid (1029-1030) signed - 当前使用"),
        (1031, "u32", "Grid (1031-1032)"),
        (1033, "u32", "Grid (1033-1034)"),
        (1035, "u32", "Grid (1035-1036)"),
        (1039, "u32", "Grid (1039-1040)"),
        (1041, "u32", "Grid (1041-1042)"),
        (1043, "u32", "Grid (1043-1044)"),
        (1045, "u32", "Grid (1045-1046)"),
        (1047, "u32", "Grid (1047-1048)"),
        (1049, "u32", "Grid (1049-1050)"),
    ]
    
    for addr, dtype, desc in grid_candidates:
        if dtype == "u32":
            val = read_u32(client, addr, args.unit)
        elif dtype == "s32":
            val = read_s32(client, addr, args.unit)
        else:
            val = read_u16(client, addr, args.unit)
        
        kw_str = format_power(val)
        # 高亮匹配目标值的寄存器
        highlight = ""
        if val is not None and args.target is not None:
            val_kw = abs(val) / 10.0 / 1000.0
            if abs(val_kw - args.target) <= args.tolerance:
                highlight = f" <<<< 匹配目标 {args.target}kW!"
        print(f"  {addr:4d} ({dtype}): {kw_str}{highlight}")
    print()

    # =========================================================================
    # 第三部分：扫描 1000-1100 范围的所有寄存器原始值
    # =========================================================================
    target_str = f"{args.target}kW" if args.target else "无目标值"
    target_raw = int(args.target * 10 * 1000) if args.target else 0
    tolerance_raw = int(args.tolerance * 10 * 1000)
    
    print(f"【3】扫描 1000-1100 范围，查找匹配 {target_str} 的值:")
    print("-" * 60)
    
    if not args.target:
        print("  提示: 使用 --target 2.76 参数指定目标 kW 值")
        print()
    
    # 读取 1000-1100 的所有寄存器
    regs_1000 = robust_read_input_registers(client, 1000, 100, args.unit)
    
    if regs_1000:
        found_candidates = []
        for i, val in enumerate(regs_1000):
            addr = 1000 + i
            
            # 检查单个 16 位值
            if args.target and abs(val - target_raw) <= tolerance_raw:
                found_candidates.append((addr, "u16", val))
            
            # 检查 32 位值 (当前 + 下一个)
            if i < len(regs_1000) - 1:
                hi = val
                lo = regs_1000[i + 1]
                u32_val = (hi << 16) | lo
                if args.target and abs(u32_val - target_raw) <= tolerance_raw:
                    found_candidates.append((addr, "u32 hi|lo", u32_val))
                
                # 也试试 lo|hi 顺序
                u32_val_rev = (lo << 16) | hi
                if args.target and abs(u32_val_rev - target_raw) <= tolerance_raw:
                    found_candidates.append((addr, "u32 lo|hi", u32_val_rev))
        
        if found_candidates:
            print("  找到匹配的候选值:")
            for addr, dtype, val in found_candidates:
                print(f"    寄存器 {addr} ({dtype}): {format_power(val)}")
        elif args.target:
            print(f"  在 1000-1100 范围未找到匹配 {target_str} 的值")
            print(f"  (容差: ±{args.tolerance}kW)")
    else:
        print("  读取失败")
    print()

    # =========================================================================
    # 第四部分：显示 dump_register.txt 中提到的关键寄存器
    # =========================================================================
    print("【4】dump_register.txt 中的关键寄存器当前值:")
    print("-" * 60)
    
    key_registers = [
        (40, 2, "watts used on load (40-41)"),
        (1009, 2, "Battery discharge power (1009-1010)"),
        (1015, 2, "AC power to user (1015-1016)"),
        (1032, 2, "Current inverter power to load (1032-1033)"),
        (1037, 2, "Total power to load (1037-1038)"),
    ]
    
    for addr, count, desc in key_registers:
        regs = robust_read_input_registers(client, addr, count, args.unit)
        if regs:
            hi, lo = regs[0], regs[1]
            u32_hi_lo = (hi << 16) | lo
            u32_lo_hi = (lo << 16) | hi
            print(f"  {desc}:")
            print(f"    原始值: [{hi}, {lo}]")
            print(f"    hi|lo = {u32_hi_lo} = {format_power(u32_hi_lo)}")
            print(f"    lo|hi = {u32_lo_hi} = {format_power(u32_lo_hi)}")
        else:
            print(f"  {desc}: 读取失败")
    print()

    # =========================================================================
    # 第五部分：专门查找 Grid Import/Export 寄存器
    # =========================================================================
    print("【5】Growatt SPH 常见的 Grid Import/Export 寄存器:")
    print("-" * 60)
    
    # 根据 Growatt SPH 文档，这些可能是 grid 相关的地址
    sph_grid_registers = [
        (1021, 2, "可能的 Grid Export (1021-1022)"),
        (1029, 2, "可能的 Grid Total (1029-1030)"),
        (1041, 2, "可能的 Grid Import (1041-1042)"),
        (1043, 2, "可能的 Grid 相关 (1043-1044)"),
        (1045, 2, "可能的 Grid 相关 (1045-1046)"),
        (1047, 2, "可能的 Grid 相关 (1047-1048)"),
    ]
    
    for addr, count, desc in sph_grid_registers:
        regs = robust_read_input_registers(client, addr, count, args.unit)
        if regs:
            hi, lo = regs[0], regs[1]
            # 尝试两种字节序
            u32_hi_lo = (hi << 16) | lo
            u32_lo_hi = (lo << 16) | hi
            
            highlight = ""
            if args.target:
                kw_hi_lo = u32_hi_lo / 10.0 / 1000.0
                kw_lo_hi = u32_lo_hi / 10.0 / 1000.0
                if abs(kw_hi_lo - args.target) <= args.tolerance:
                    highlight = f" <<<< hi|lo 匹配目标 {args.target}kW!"
                elif abs(kw_lo_hi - args.target) <= args.tolerance:
                    highlight = f" <<<< lo|hi 匹配目标 {args.target}kW!"
            
            print(f"  {desc}:")
            print(f"    [{hi}, {lo}] -> hi|lo={format_power(u32_hi_lo)}, lo|hi={format_power(u32_lo_hi)}{highlight}")
        else:
            print(f"  {desc}: 读取失败")
    print()

    # =========================================================================
    # 总结
    # =========================================================================
    print("=" * 80)
    print("总结:")
    print("=" * 80)
    
    if args.target:
        print(f"""
目标值: {args.target} kW (容差: ±{args.tolerance} kW)

查看上面标记 "<<<< 匹配" 的寄存器。

如果找到匹配的寄存器，请告诉我：
1. 寄存器地址
2. 数据类型 (u16/u32/s32)
3. 字节序 (hi|lo 还是 lo|hi)

然后我可以帮你修改 api_server.py 使用正确的寄存器。
""")
    else:
        print("""
提示: 使用 --target 参数指定官网显示的 kW 值

示例:
  python test_grid_registers.py --target 2.76
  python test_grid_registers.py -t 5.54
  python test_grid_registers.py -t 2.76 --tolerance 0.1

这样脚本会自动高亮匹配的寄存器。
""")

    client.close()


if __name__ == "__main__":
    main()
