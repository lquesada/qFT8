import glob

insert_before_h4_2 = """            <h4>2. Firmware doesn't support power measurement</h4>
            <p>
                If the <span translate="no">QMX</span> does not show that <span translate="no">SWR</span> protection is engaged, and it shows that transmission is happening properly, it may be that the firmware is old and does not support power measurement. Devices like the <span translate="no">QDX</span> also do not support power measurement. <span translate="no">qFT8</span> does not know how to interpret 0<span translate="no">W</span> and it gets confused.
            </p>
            <p>
                <strong>Try:</strong> If your <span translate="no">QMX</span> firmware is old, update it. If you are using a <span translate="no">QDX</span>, there is no way around this.
            </p>

"""

insert_4 = """

            <h4>4. SWR is low during tuner but SWR protection kicks in</h4>
            <p>
                This seems like SWR is spiking or peaking at high power for some instants during actual transmission, which triggers SWR protection. This is an indicator of a finnicky antenna (e.g. magloops), a bad cable, a bad connection, or an issue in the setup.
            </p>"""

files = glob.glob("/home/antigravity-user/anti/qmxandroid/qFT8/docs/manual/**/index.html", recursive=True)

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. replace two likely with several likely in English (if exists)
    content = content.replace("two likely\n                causes:", "several likely\n                causes:")
    content = content.replace("two likely causes:", "several likely causes:")
    
    # 2. replace <h4>2. with <h4>2. Firmware... <h4>3. 
    # we know <h4>2. exists exactly once in each file
    if "<h4>2. " in content:
        content = content.replace("<h4>2. ", insert_before_h4_2 + "            <h4>3. ")
    
    # 3. insert <h4>4. after the paragraph of <h4>3.
    parts = content.split('Set system volume to [X] when transmitting</span>"')
    if len(parts) >= 3:
        p2_parts = parts[2].split("</p>", 1)
        if len(p2_parts) == 2:
            parts[2] = p2_parts[0] + "</p>" + insert_4 + p2_parts[1]
        content = 'Set system volume to [X] when transmitting</span>"'.join(parts)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Done")
