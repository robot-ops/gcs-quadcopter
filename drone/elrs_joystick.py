import time
import sys
import pygame
import serial

SERIAL_PORT = "COM7"
# ExpressLRS default hardware baud rate adalah 400000 (bisa 115200 atau 420000)
BAUDRATE = 400000

# CRSF Addressing: Ke modul Transmitter adalah 0xEE
CRSF_ADDRESS_CRSF_TRANSMITTER = 0xEE
CRSF_FRAMETYPE_RC_CHANNELS_PACKED = 0x16

def crc8_dvb_s2(data: bytes) -> int:
    crc = 0
    for b in data:
        crc ^= b
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ 0xD5) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc

def pack_crsf_frame(channels):
    """
    channels: list of 16 integers (172..1811)
    11-bit per channel -> 22 bytes packed payload
    """
    payload = bytearray(23)
    payload[0] = CRSF_FRAMETYPE_RC_CHANNELS_PACKED
    
    # 16 channels packed into 22 bytes
    bits = 0
    bits_count = 0
    byte_idx = 1
    
    for ch in channels:
        val = max(172, min(1811, int(ch)))
        bits |= (val << bits_count)
        bits_count += 11
        while bits_count >= 8 and byte_idx < 23:
            payload[byte_idx] = bits & 0xFF
            bits >>= 8
            bits_count -= 8
            byte_idx += 1
            
    # Full Frame: [Address (0xEE)] [Length] [Type + 22 bytes Channels] [CRC]
    frame_len = len(payload) + 1  # payload length + 1 byte crc = 24
    header = bytes([CRSF_ADDRESS_CRSF_TRANSMITTER, frame_len])
    crc = crc8_dvb_s2(payload)
    return header + bytes(payload) + bytes([crc])

def scale_axis_to_crsf(val, reverse=False):
    if reverse:
        val = -val
    crsf_val = 992 + int(val * 819)
    return max(172, min(1811, crsf_val))

def main():
    print("=" * 65)
    print("  AERO-LINK GCS: Enhanced CRSF Joystick Bridge")
    print("=" * 65)
    
    pygame.init()
    pygame.joystick.init()
    
    if pygame.joystick.get_count() == 0:
        print("[-] Error: Stik M-Tech tidak terdeteksi! Colokkan stik ke USB.")
        return
        
    js = pygame.joystick.Joystick(0)
    js.init()
    print(f"[+] Gamepad: {js.get_name()} (Axis: {js.get_numaxes()}, Tombol: {js.get_numbuttons()})")
    
    baud = BAUDRATE
    if len(sys.argv) > 1:
        baud = int(sys.argv[1])
        
    print(f"[+] Membuka serial {SERIAL_PORT} @ {baud} baud...")
    try:
        ser = serial.Serial(SERIAL_PORT, baud, timeout=0.01)
    except Exception as e:
        print(f"[-] Gagal membuka serial {SERIAL_PORT}: {e}")
        return

    print("[+] Transmisi aktif (100Hz). Perhatikan bar di tab Receiver INAV!")
    print("    Tekan Ctrl + C untuk keluar.\n")
    
    channels = [992] * 16
    channels[2] = 172  # Throttle minimum 172 (1000us)
    
    last_debug = 0
    try:
        while True:
            pygame.event.pump()
            
            # Map Axis M-Tech Gamepad
            # Axis 0: Roll, Axis 1: Pitch, Axis 2: Throttle, Axis 3: Yaw
            channels[0] = scale_axis_to_crsf(js.get_axis(0))
            channels[1] = scale_axis_to_crsf(js.get_axis(1), reverse=True)
            channels[2] = scale_axis_to_crsf(js.get_axis(2), reverse=True) if js.get_numaxes() > 2 else 172
            channels[3] = scale_axis_to_crsf(js.get_axis(3)) if js.get_numaxes() > 3 else 992
            
            # AUX1 (Arming): Tombol 0 / 6
            is_armed = js.get_button(0) or js.get_button(6)
            channels[4] = 1811 if is_armed else 172
            
            frame = pack_crsf_frame(channels)
            ser.write(frame)
            
            now = time.time()
            if now - last_debug > 0.15:
                arm_text = "ARMED" if is_armed else "DISARM"
                print(f"\r[CRSF 100Hz] AIL:{channels[0]:4d} ELE:{channels[1]:4d} THR:{channels[2]:4d} RUD:{channels[3]:4d} | {arm_text} ", end="", flush=True)
                last_debug = now
                
            time.sleep(0.01)  # 10ms = 100Hz CRSF Packet Rate
            
    except KeyboardInterrupt:
        print("\n[!] Dihentikan.")
    finally:
        ser.close()

if __name__ == "__main__":
    main()
