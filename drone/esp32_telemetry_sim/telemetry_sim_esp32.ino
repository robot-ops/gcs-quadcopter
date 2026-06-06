/*
 * Aero-Link GCS - ESP32 Telemetry Simulator (Two-Way Command Version)
 * 
 * Deskripsi:
 * Program ini bertindak sebagai simulator drone fisik dua arah.
 * 1. Menerima perintah dari GCS (via Serial USB):
 *    - "CMD:ARM"     -> Mengaktifkan drone, LED D5 menyala solid.
 *    - "CMD:DISARM"  -> Menonaktifkan drone, LED D5 mati.
 *    - "CMD:TAKEOFF" -> Lepas landas, LED D5 berkedip lambat (500ms), ketinggian naik ke 15m.
 *    - "CMD:LAND"    -> Mendarat, LED D5 berkedip cepat (100ms), ketinggian turun ke 0m.
 * 2. Mengirim data telemetri biner 28-byte dengan kalkulasi CRC-16 secara real-time
 *    yang nilainya mencerminkan kondisi status penerbangan aktif drone saat ini.
 * 
 * Rangkaian:
 * - ESP32 D5 (GPIO 5) -> Resistor 220Ω -> Anoda LED (+)
 * - ESP32 GND -> Katoda LED (-)
 */

#include <Arduino.h>

// Struktur paket data telemetri (Packed Struct - 28 Bytes)
struct __attribute__((__packed__)) TelemetryPacket {
    uint8_t magic;      // Magic byte 0xAA (Byte 0)
    uint8_t drone_id;   // ID Drone (Byte 1)
    int32_t latitude;   // Latitude * 10^7 (Byte 2-5)
    int32_t longitude;  // Longitude * 10^7 (Byte 6-9)
    int16_t altitude;   // Ketinggian relatif dalam desimeter (Byte 10-11)
    int16_t roll;       // Roll * 100 dalam derajat (Byte 12-13)
    int16_t pitch;      // Pitch * 100 dalam derajat (Byte 14-15)
    uint16_t yaw;       // Yaw * 100 dalam derajat (Byte 16-17)
    uint8_t battery;    // Baterai % (Byte 18)
    uint16_t speed;     // Speed * 100 dalam m/s (Byte 19-20)
    int8_t rssi;        // RSSI dBm (Byte 21)
    int16_t snr;        // SNR * 10 dB (Byte 22-23)
    uint16_t counter;   // Paket Counter (Byte 24-25)
    uint16_t crc;       // CRC-16 Checksum (Byte 26-27)
};

// Status Drone
enum DroneState {
    STATE_DISARMED,
    STATE_ARMED,
    STATE_TAKEOFF,
    STATE_FLYING,
    STATE_LANDING
};

// Pin & ID
const uint8_t LED_PIN = 5;               // Pin D5 (GPIO 5) untuk LED Drone
const uint8_t DRONE_ID = 1;

// Konstanta Koordinat Awal (Jakarta)
const double BASE_LAT = -6.2088;
const double BASE_LNG = 106.8456;
const unsigned long SEND_INTERVAL = 500; // Kirim telemetri setiap 500ms

// Variabel Kontrol & Status
DroneState current_state = STATE_DISARMED;
uint16_t packet_counter = 0;
float simulated_battery = 100.0;
unsigned long last_send_time = 0;

// Variabel Posisi & Sikap Drone Aktual
double current_lat = BASE_LAT;
double current_lng = BASE_LNG;
float current_alt = 0.0;
float current_roll = 0.0;
float current_pitch = 0.0;
float current_yaw = 0.0;
float current_speed = 0.0;

// Variabel LED Blink (Non-blocking)
unsigned long led_last_toggle = 0;
bool led_state = false;

// Fungsi untuk menghitung CRC-16 CCITT (Polynomial: 0x1021, Init: 0x0000)
uint16_t calculate_crc16(const uint8_t *data, size_t length) {
    uint16_t crc = 0x0000;
    for (size_t i = 0; i < length; ++i) {
        crc ^= (uint16_t)data[i] << 8;
        for (uint8_t j = 0; j < 8; ++j) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

// Mengatur status LED D5 berdasarkan kondisi drone
void update_led_state() {
    unsigned long now = millis();
    
    switch (current_state) {
        case STATE_DISARMED:
            digitalWrite(LED_PIN, LOW);
            led_state = false;
            break;
            
        case STATE_ARMED:
            digitalWrite(LED_PIN, HIGH);
            led_state = true;
            break;
            
        case STATE_TAKEOFF:
        case STATE_FLYING:
            // Kedip lambat (500ms) untuk terbang/takeoff
            if (now - led_last_toggle >= 500) {
                led_state = !led_state;
                digitalWrite(LED_PIN, led_state ? HIGH : LOW);
                led_last_toggle = now;
            }
            break;
            
        case STATE_LANDING:
            // Kedip cepat (100ms) untuk proses pendaratan
            if (now - led_last_toggle >= 100) {
                led_state = !led_state;
                digitalWrite(LED_PIN, led_state ? HIGH : LOW);
                led_last_toggle = now;
            }
            break;
    }
}

void setup() {
    // Inisialisasi Serial USB dengan baud rate 115200
    Serial.begin(115200);
    // Atur timeout pembacaan serial pendek agar non-blocking
    Serial.setTimeout(10);
    
    // Konfigurasi LED pin D5 sebagai output
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
}

void loop() {
    // 1. CEK PERINTAH MASUK DARI SERIAL USB
    if (Serial.available() > 0) {
        String inputCmd = Serial.readStringUntil('\n');
        inputCmd.trim();
        
        if (inputCmd == "CMD:ARM") {
            if (current_state == STATE_DISARMED) {
                current_state = STATE_ARMED;
                simulated_battery = 100.0; // Reset baterai jika di-arm ulang
            }
        } 
        else if (inputCmd == "CMD:DISARM") {
            current_state = STATE_DISARMED;
            current_alt = 0.0;
            current_speed = 0.0;
            current_roll = 0.0;
            current_pitch = 0.0;
        } 
        else if (inputCmd == "CMD:TAKEOFF") {
            if (current_state == STATE_ARMED || current_state == STATE_DISARMED) {
                current_state = STATE_TAKEOFF;
            }
        } 
        else if (inputCmd == "CMD:LAND") {
            if (current_state == STATE_FLYING || current_state == STATE_TAKEOFF) {
                current_state = STATE_LANDING;
            }
        }
    }

    // Update status LED secara non-blocking
    update_led_state();

    // 2. SIMULASI PERGERAKAN TELEMETRI BERDASARKAN STATE SEKARANG
    unsigned long current_time = millis();
    if (current_time - last_send_time >= SEND_INTERVAL) {
        last_send_time = current_time;
        packet_counter++;

        float angle = packet_counter * 0.05;

        if (current_state == STATE_DISARMED) {
            current_alt = 0.0;
            current_speed = 0.0;
            current_roll = 0.0;
            current_pitch = 0.0;
            // Baterai naik lambat di darat (simulasi charging)
            if (simulated_battery < 100.0) simulated_battery = min(100.0f, simulated_battery + 0.2f);
        } 
        else if (current_state == STATE_ARMED) {
            current_alt = 0.0;
            current_speed = 0.0;
            current_roll = 0.0;
            current_pitch = 0.0;
            simulated_battery = max(0.0f, simulated_battery - 0.01f);
        } 
        else if (current_state == STATE_TAKEOFF) {
            current_speed = 1.0;
            current_roll = sin(angle * 2) * 2.0;
            current_pitch = cos(angle * 2) * 1.5;
            current_yaw = fmod(current_yaw + 1.0, 360.0);
            
            // Naik perlahan ke ketinggian target 15 meter
            current_alt += 0.5;
            simulated_battery = max(0.0f, simulated_battery - 0.05f);
            
            if (current_alt >= 15.0) {
                current_alt = 15.0;
                current_state = STATE_FLYING; // Terbang melayang (hover/mission)
            }
        } 
        else if (current_state == STATE_FLYING) {
            current_speed = 3.5 + sin(angle) * 0.5;
            current_roll = sin(angle * 3) * 6.0;   // goyangan terbang
            current_pitch = cos(angle * 3) * 4.0;
            current_yaw = fmod(current_yaw + 1.5, 360.0);
            simulated_battery = max(0.0f, simulated_battery - 0.08f);

            // Pergerakan melingkar pada koordinat GPS
            float radius = 0.0004;
            current_lat = BASE_LAT + (sin(angle) * radius);
            current_lng = BASE_LNG + (cos(angle) * radius);
            
            // Sedikit fluktuasi angin pada ketinggian
            current_alt = 15.0 + sin(angle * 2) * 0.15;
            
            // Auto land jika baterai menipis
            if (simulated_battery <= 10.0) {
                current_state = STATE_LANDING;
            }
        } 
        else if (current_state == STATE_LANDING) {
            current_speed = max(0.2f, current_speed - 0.2f);
            current_roll = sin(angle * 2) * 1.5;
            current_pitch = cos(angle * 2) * 1.0;
            simulated_battery = max(0.0f, simulated_battery - 0.03f);

            // Turun perlahan ke 0
            current_alt -= 0.5;
            if (current_alt <= 0.0) {
                current_alt = 0.0;
                current_state = STATE_DISARMED; // Matikan mesin setelah mendarat
            }
        }

        // Kualitas sinyal LoRa tiruan
        int8_t current_rssi = -45 + (int8_t)(sin(angle * 0.5) * 10);
        float current_snr = 14.5 + cos(angle * 0.5) * 2.0;

        // 3. PENGEMASAN DATA KE BINER UNTUK DIKIRIM KE LAPTOP
        TelemetryPacket packet;
        packet.magic = 0xAA;
        packet.drone_id = DRONE_ID;
        packet.latitude = (int32_t)(current_lat * 1e7);
        packet.longitude = (int32_t)(current_lng * 1e7);
        packet.altitude = (int16_t)(current_alt * 10); // meter ke desimeter
        packet.roll = (int16_t)(current_roll * 100);
        packet.pitch = (int16_t)(current_pitch * 100);
        packet.yaw = (uint16_t)(current_yaw * 100);
        packet.battery = (uint8_t)simulated_battery;
        packet.speed = (uint16_t)(current_speed * 100);
        packet.rssi = current_rssi;
        packet.snr = (int16_t)(current_snr * 10);
        packet.counter = packet_counter;

        // Hitung CRC-16
        packet.crc = calculate_crc16((uint8_t*)&packet, sizeof(packet) - sizeof(packet.crc));

        // Kirim paket biner lewat Serial
        Serial.write((uint8_t*)&packet, sizeof(packet));
        Serial.flush();
    }
}
