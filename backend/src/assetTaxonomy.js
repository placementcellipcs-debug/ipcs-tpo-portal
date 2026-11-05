// Canonical three-level asset taxonomy. Category and subcategory IDs are
// stable; brands, models, serial numbers, and quantities belong on records.
const categories = [
  ['AUT', 'Industrial Automation Equipment', 'ASSET', [
    ['Controllers & Processors', 'PLC|DCS|PAC|PLC trainer kit'],
    ['HMI & Operator Interfaces', 'HMI touch panel|Industrial operator terminal'],
    ['SCADA & Process Control Systems', 'SCADA system|SCADA trainer|DCS hardware rack|Process control rig|Analog process loop|Pressure regulation loop|Temperature regulation loop|Level regulation loop|Flow regulation loop'],
    ['Drives & Power Electronics', 'VFD|AC drive|Servo drive|Soft starter'],
    ['Motors & Actuators', 'AC motor|DC motor|Three-phase induction motor|AC servo motor|DC servo motor|Servo motor|Stepper motor|Pneumatic actuator|Pneumatic cylinder|Solenoid valve'],
    ['Sensors & Field Instruments', 'Inductive proximity sensor|Capacitive proximity sensor|Proximity sensor|Photoelectric sensor|Photomicrosensor|Temperature sensor|Temperature transmitter|RTD sensor|Thermocouple|Pressure transmitter|Flow transmitter|Flow meter|Level transmitter|Level switch|Displacement sensor|Incremental encoder|Absolute encoder|Rotary encoder'],
    ['Electrical Control Panels & Switchgear', 'PLC training panel|PLC panel|VFD panel|HVAC control panel|AMF panel|Capacitor panel|Relay board|Relay|Contactor|MCB|MCCB'],
    ['Industrial Electrical Components', 'SMPS|Terminal block|Push button|Indicator lamp|Multi-function meter|Digital panel meter|Panel meter|Load monitoring system|Power monitoring system|Timer'],
    ['Pneumatics & Hydraulics', 'Pneumatic cylinder|Solenoid valve|Pneumatic trainer|Hydraulic trainer'],
    ['Process Calibration & Testing', 'Process calibration instrument|Calibration instrument|Process testing equipment'],
    ['Industrial Communication Equipment', 'Modbus interface|PROFIBUS interface|PROFINET interface|Ethernet/IP interface|CANopen interface']
  ]],
  ['BMS', 'Building Management, HVAC & Security Systems', 'ASSET', [
    ['BMS Controllers & Automation', 'DDC controller|SmartX controller|Desigo controller|BMS control panel'],
    ['HVAC & Environmental Control', 'HVAC controller|Thermostat|Damper actuator|CO2 sensor|Humidity sensor|Differential pressure switch'],
    ['CCTV & Video Surveillance', 'IP camera|Dome camera|Bullet camera|PTZ camera|Analog camera'],
    ['Video Recording & Monitoring', 'NVR|DVR|Surveillance monitor|Storage array'],
    ['Access Control & Biometrics', 'Fingerprint reader|Face recognition reader|RFID reader|Door controller'],
    ['Electronic Locks & Intrusion Detection', 'Electromagnetic door lock|Drop bolt|PIR motion sensor|Magnetic contact'],
    ['Fire Alarm & Life Safety', 'Fire alarm control panel|Smoke detector|Heat detector|Manual call point|Sounder|Hooter'],
    ['Security Networking & Accessories', 'PoE switch|BNC patch panel|RJ45 patch panel|CCTV accessory']
  ]],
  ['EMB', 'Embedded Systems & IoT Equipment', 'ASSET', [
    ['Microcontrollers & Development Boards', 'PIC board|ARM board|STM32 board|NXP LPC board|8051 board'],
    ['Arduino & Raspberry Pi Systems', 'Arduino Uno|Arduino Nano|Arduino Mega|Raspberry Pi 3|Raspberry Pi 4|Raspberry Pi 5'],
    ['ESP & Wireless Development Boards', 'ESP8266 board|NodeMCU board|ESP32 board'],
    ['Sensors & Interfacing Modules', 'Ultrasonic sensor|PIR sensor|DHT11 sensor|DHT22 sensor|Gas sensor|MPU6050 module'],
    ['Displays & User Interfaces', 'LCD display|OLED display|TFT touchscreen|7-segment display'],
    ['Communication & Connectivity Modules', 'GSM/GPRS module|GPS module|RFID module|Zigbee module|LoRa module|Wi-Fi module|Bluetooth module'],
    ['Electronic Components & Prototyping', 'Resistor kit|Capacitor kit|IC kit|Breadboard|Jumper wire set'],
    ['Motor & Relay Driver Modules', 'L298N driver|Motor driver shield|Relay module'],
    ['Embedded Lab Instruments', 'Digital storage oscilloscope|Logic analyzer|Multimeter|Variable DC power supply'],
    ['Soldering & Rework Equipment', 'Soldering station|Rework station|PCB tool set']
  ]],
  ['IT', 'IT, Computing & Networking Equipment', 'ASSET', [
    ['Computers & Workstations', 'Desktop PC|Laptop|Student workstation|Instructor workstation'],
    ['Servers & Storage', 'Server|NAS|External storage|Hard drive'],
    ['Computer Peripherals', 'Monitor|Keyboard|Mouse|Webcam|Headset'],
    ['Printing & Scanning Equipment', 'Printer|Scanner|Multifunction printer'],
    ['Networking Equipment', 'Router|Network switch|Wi-Fi access point|Firewall'],
    ['Network Cabling & Accessories', 'Ethernet cable|Fiber cable|RJ45 connector|Patch panel'],
    ['Communication Equipment', 'IP phone|Conference system|Communication device'],
    ['Power Backup & Protection', 'UPS|Power backup unit|Surge protector']
  ]],
  ['ELE', 'Electrical, Wiring & Lighting Equipment', 'ASSET', [
    ['Wires & Cables', 'Electrical wire|Power cable|Control cable'],
    ['Switches & Sockets', 'Modular switch|Electrical socket|Plug top'],
    ['Lighting Equipment', 'LED bulb|Tube light|Panel light|Emergency light'],
    ['Circuit Protection', 'MCB|MCCB|RCCB|ELCB|Fuse'],
    ['Electrical Distribution', 'Distribution board|Busbar|Electrical panel'],
    ['Electrical Accessories', 'Conduit|Cable tray|Junction box|Cable gland'],
    ['Earthing & Lightning Protection', 'Earth clamp|Earth rod|Lightning arrester'],
    ['Electrical Testing Instruments', 'Clamp meter|Insulation tester|Voltage tester'],
    ['Electrical Installation Tools', 'Wire stripper|Crimping tool|Cable cutter']
  ]],
  ['MEC', 'Mechanical, Workshop & Fabrication Equipment', 'ASSET', [
    ['Workshop Machinery', 'Drilling machine|Lathe|Milling machine'],
    ['Hand Tools', 'Spanner set|Screwdriver set|Pliers|Hammer'],
    ['Power Tools', 'Grinder|Power drill|Cutting tool'],
    ['Welding & Fabrication Equipment', 'Welding machine|Welding accessory|Fabrication tool'],
    ['Mechanical Components', 'Bearing|Gear|Shaft|Coupling|Fastener set'],
    ['Material Handling Equipment', 'Trolley|Lifting equipment|Material handling tool'],
    ['Mechanical Testing Equipment', 'Mechanical testing instrument|Mechanical measurement instrument']
  ]],
  ['SW', 'Software Licenses & Digital Assets', 'ASSET', [
    ['Industrial Automation Software', 'TIA Portal|STEP 7|MicroWIN|RSLogix|Studio 5000|WPLSoft|ISPSoft|GX Works|SoMachine|Machine Expert|CX-Programmer'],
    ['SCADA & HMI Software', 'WinCC|WinCC Flexible|Wonderware InTouch|FactoryTalk View|RSView|Citect SCADA|DOPSoft|Screen Editor'],
    ['DCS & BMS Software', 'ABB Freelance|Emerson DeltaV|EcoStruxure Building Operation|Niagara Framework|Honeywell EBI|Honeywell CARE|WIN-PAK'],
    ['CCTV & Security Software', 'iVMS-4200|SmartPSS|Milestone XProtect|ZKAccess|BioSecurity|Video Management Software'],
    ['Embedded Development Software', 'Keil uVision|MPLAB X IDE|Arduino IDE|STM32CubeIDE|Embedded C/C++ toolchain|GCC compiler|MicroPython'],
    ['CAD & Engineering Software', 'AutoCAD|KiCad|Eagle CAD|Proteus'],
    ['Programming & Development Tools', 'Python|VS Code|PyCharm|Jupyter Notebook|Anaconda'],
    ['AI & Data Science Software', 'TensorFlow|OpenCV|NumPy|Pandas|Scikit-learn'],
    ['Software Testing Tools', 'Selenium|JUnit|TestNG|Postman|JMeter|Jira|Bugzilla'],
    ['Web Development & Database Software', 'PHP|.NET|MySQL|Node.js'],
    ['Digital Marketing & Analytics Software', 'Google Analytics|Google Ads|Meta Ads Manager|SEMrush|Ahrefs|Canva|WordPress'],
    ['IoT Platforms & Cloud Software', 'Blynk|ThingSpeak|Adafruit IO|AWS IoT Core|Node-RED|MQTT client/broker|HTTP/HTTPS IoT client|CoAP client|WebSockets IoT client']
  ]],
  ['PLB', 'Plumbing, Water & Sanitation Equipment', 'ASSET', [
    ['Plumbing Fixtures & Fittings', 'Faucet|Wash basin|Valve|Pipe fitting'],
    ['Pipes & Water Distribution', 'Water pipe|Pipe connector|Water distribution accessory'],
    ['Pumps & Water Systems', 'Water pump|Pressure pump'],
    ['Water Storage & Treatment', 'Water tank|Water filter|Water purification system'],
    ['Sanitation Equipment', 'Toilet|Flush system|Sanitation fixture']
  ]],
  ['FUR', 'Furniture, Classroom & Office Equipment', 'ASSET', [
    ['Classroom Furniture', 'Student desk|Student chair|Bench'],
    ['Office Furniture', 'Office table|Office chair|Cabinet'],
    ['Storage & Shelving', 'Rack|Cupboard|Storage cabinet'],
    ['Presentation & Display Equipment', 'Projector|Projection screen|Interactive board|Notice board'],
    ['Meeting & Conference Equipment', 'Conference table|Meeting room equipment']
  ]],
  ['SAF', 'Safety, Security & Emergency Equipment', 'ASSET', [
    ['Personal Protective Equipment', 'Safety helmet|Safety gloves|Safety shoes|Safety goggles'],
    ['Fire Safety Equipment', 'Fire extinguisher|Fire blanket'],
    ['First Aid & Emergency Equipment', 'First aid kit|Emergency kit'],
    ['General Safety & Signage', 'Safety sign|Safety barrier|Emergency signage']
  ]],
  ['LAB', 'Laboratory & Measurement Instruments', 'ASSET', [
    ['Electronic Measurement Instruments', 'Multimeter|Oscilloscope|Signal generator|Logic analyzer'],
    ['Electrical Measurement Instruments', 'Power analyzer|Energy meter|Insulation tester'],
    ['Mechanical Measurement Instruments', 'Vernier caliper|Micrometer|Gauge'],
    ['Scientific & General Lab Instruments', 'General laboratory instrument|Scientific instrument']
  ]],
  ['GEN', 'General Assets, Consumables & Miscellaneous', 'GENERAL', [
    ['General Office Equipment', 'Calculator|Office equipment'],
    ['Consumables & Supplies', 'Consumable supply|Stationery|Paper|Pen|Marker|Consumable lab material'],
    ['Spare Parts & Maintenance Items', 'Replacement component|Maintenance supply|Spare part'],
    ['Other / Unclassified Assets', 'Unclassified asset|Other managed item']
  ]]
];

const categoryRows = [];
const subcategoryRows = [];
const assetTypeRows = [];
for (const [categoryCode, categoryName, type, subcategories] of categories) {
  // Keep the category ID aligned with the compact master code used in the
  // supplied taxonomy (AUT, BMS, EMB, IT, and so on).
  const categoryId = categoryCode;
  categoryRows.push({ categoryid: categoryId, categorycode: categoryCode, categoryname: categoryName, type, status: 'ACTIVE' });
  subcategories.forEach(([subcategoryName, typeList], index) => {
    const subcategoryId = `${categoryCode}-SC${String(index + 1).padStart(2, '0')}`;
    const entryType = categoryCode === 'GEN' && subcategoryName === 'Consumables & Supplies' ? 'CONSUMABLE' : (type === 'GENERAL' ? 'ASSET' : type);
    subcategoryRows.push({ subcategoryid: subcategoryId, categoryid: categoryId, categoryname: categoryName, subcategoryname: subcategoryName, type: entryType, status: 'ACTIVE' });
    typeList.split('|').map(value => value.trim()).filter(Boolean).forEach((assetTypeName, typeIndex) => {
      assetTypeRows.push({ assettypeid: `${subcategoryId}-T${String(typeIndex + 1).padStart(2, '0')}`, categoryid: categoryId, categoryname: categoryName, subcategoryid: subcategoryId, subcategoryname: subcategoryName, assettypename: assetTypeName, type: entryType, status: 'ACTIVE' });
    });
  });
}

module.exports = {
  categories,
  categoryRows,
  subcategoryRows,
  assetTypeRows,
  headers: {
    categories: ['Category_ID', 'Category_Code', 'Category_Name', 'Type', 'Status'],
    subcategories: ['Subcategory_ID', 'Category_ID', 'Category_Name', 'Subcategory_Name', 'Type', 'Status'],
    assetTypes: ['Asset_Type_ID', 'Category_ID', 'Category_Name', 'Subcategory_ID', 'Subcategory_Name', 'Asset_Type_Name', 'Type', 'Status']
  }
};
