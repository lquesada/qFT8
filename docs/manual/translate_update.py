import glob

# Original English texts that we inserted
eng_p1 = """            <h4>2. Firmware doesn't support power measurement</h4>
            <p>
                If the <span translate="no">QMX</span> does not show that <span translate="no">SWR</span> protection is engaged, and it shows that transmission is happening properly, it may be that the firmware is old and does not support power measurement. Devices like the <span translate="no">QDX</span> also do not support power measurement. <span translate="no">qFT8</span> does not know how to interpret 0<span translate="no">W</span> and it gets confused.
            </p>
            <p>
                <strong>Try:</strong> If your <span translate="no">QMX</span> firmware is old, update it. If you are using a <span translate="no">QDX</span>, there is no way around this.
            </p>"""

eng_p2 = """            <h4>4. SWR is low during tuner but SWR protection kicks in</h4>
            <p>
                This seems like SWR is spiking or peaking at high power for some instants during actual transmission, which triggers SWR protection. This is an indicator of a finnicky antenna (e.g. magloops), a bad cable, a bad connection, or an issue in the setup.
            </p>"""

# Translations
translations = {
    'es': {
        'p1': """            <h4>2. El firmware no admite medición de potencia</h4>
            <p>
                Si el <span translate="no">QMX</span> no muestra que la protección <span translate="no">SWR</span> está activada, y muestra que la transmisión se está realizando correctamente, puede que el firmware sea antiguo y no admita la medición de potencia. Dispositivos como el <span translate="no">QDX</span> tampoco admiten la medición de potencia. <span translate="no">qFT8</span> no sabe cómo interpretar 0<span translate="no">W</span> y se confunde.
            </p>
            <p>
                <strong>Intente lo siguiente:</strong> Si el firmware de su <span translate="no">QMX</span> es antiguo, actualícelo. Si está usando un <span translate="no">QDX</span>, no hay solución para esto.
            </p>""",
        'p2': """            <h4>4. El SWR es bajo al sintonizar, pero se activa la protección SWR</h4>
            <p>
                Parece que el SWR se dispara o alcanza picos de alta potencia durante algunos instantes de la transmisión real, lo que activa la protección SWR. Este es un indicador de una antena delicada (p. ej. bucles magnéticos), un cable en mal estado, una mala conexión o un problema en la configuración.
            </p>"""
    },
    'fr': {
        'p1': """            <h4>2. Le firmware ne prend pas en charge la mesure de puissance</h4>
            <p>
                Si le <span translate="no">QMX</span> ne montre pas que la protection <span translate="no">SWR</span> est activée, et qu'il montre que la transmission s'effectue correctement, il se peut que le firmware soit ancien et ne prenne pas en charge la mesure de puissance. Les appareils comme le <span translate="no">QDX</span> ne prennent pas non plus en charge la mesure de puissance. <span translate="no">qFT8</span> ne sait pas comment interpréter 0<span translate="no">W</span> et devient confus.
            </p>
            <p>
                <strong>Essayez ceci :</strong> Si le firmware de votre <span translate="no">QMX</span> est ancien, mettez-le à jour. Si vous utilisez un <span translate="no">QDX</span>, il n'y a pas de solution de contournement.
            </p>""",
        'p2': """            <h4>4. Le SWR est faible pendant l'accord, mais la protection SWR se déclenche</h4>
            <p>
                Il semble que le SWR présente des pics à haute puissance pendant quelques instants lors de la transmission réelle, ce qui déclenche la protection SWR. C'est l'indicateur d'une antenne capricieuse (par ex. antennes cadres magnétiques), d'un mauvais câble, d'une mauvaise connexion ou d'un problème dans la configuration.
            </p>"""
    },
    'de': {
        'p1': """            <h4>2. Firmware unterstützt keine Leistungsmessung</h4>
            <p>
                Wenn der <span translate="no">QMX</span> nicht anzeigt, dass der <span translate="no">SWR</span>-Schutz aktiviert ist, und anzeigt, dass die Übertragung ordnungsgemäß läuft, kann es sein, dass die Firmware alt ist und keine Leistungsmessung unterstützt. Geräte wie der <span translate="no">QDX</span> unterstützen ebenfalls keine Leistungsmessung. <span translate="no">qFT8</span> weiß nicht, wie 0<span translate="no">W</span> zu interpretieren ist, und gerät durcheinander.
            </p>
            <p>
                <strong>Versuchen Sie Folgendes:</strong> Wenn Ihre <span translate="no">QMX</span>-Firmware alt ist, aktualisieren Sie sie. Wenn Sie einen <span translate="no">QDX</span> verwenden, gibt es dafür keine Lösung.
            </p>""",
        'p2': """            <h4>4. Das SWR ist beim Abstimmen niedrig, aber der SWR-Schutz greift ein</h4>
            <p>
                Es scheint, als ob das SWR bei hoher Leistung während der eigentlichen Übertragung für einige Momente in die Höhe schnellt oder Spitzenwerte erreicht, was den SWR-Schutz auslöst. Dies ist ein Anzeichen für eine empfindliche Antenne (z. B. Magloops), ein defektes Kabel, eine schlechte Verbindung oder ein Problem im Setup.
            </p>"""
    },
    'it': {
        'p1': """            <h4>2. Il firmware non supporta la misurazione della potenza</h4>
            <p>
                Se il <span translate="no">QMX</span> non mostra che la protezione <span translate="no">SWR</span> è attivata, e mostra che la trasmissione sta avvenendo correttamente, è possibile che il firmware sia vecchio e non supporti la misurazione della potenza. Anche dispositivi come il <span translate="no">QDX</span> non supportano la misurazione della potenza. <span translate="no">qFT8</span> non sa come interpretare 0<span translate="no">W</span> e si confonde.
            </p>
            <p>
                <strong>Prova questo:</strong> Se il firmware del tuo <span translate="no">QMX</span> è vecchio, aggiornalo. Se stai utilizzando un <span translate="no">QDX</span>, non c'è modo di aggirare il problema.
            </p>""",
        'p2': """            <h4>4. Il SWR è basso durante l'accordo ma la protezione SWR si attiva</h4>
            <p>
                Sembra che il SWR stia avendo dei picchi ad alta potenza per alcuni istanti durante la trasmissione effettiva, il che innesca la protezione SWR. Questo è un indicatore di un'antenna instabile (ad esempio magloop), un cavo difettoso, una connessione scadente o un problema nella configurazione.
            </p>"""
    },
    'pt': {
        'p1': """            <h4>2. O firmware não suporta medição de potência</h4>
            <p>
                Se o <span translate="no">QMX</span> não mostrar que a proteção <span translate="no">SWR</span> está ativada, e mostrar que a transmissão está ocorrendo corretamente, pode ser que o firmware seja antigo e não suporte a medição de potência. Dispositivos como o <span translate="no">QDX</span> também não suportam medição de potência. O <span translate="no">qFT8</span> não sabe como interpretar 0<span translate="no">W</span> e fica confuso.
            </p>
            <p>
                <strong>Tente o seguinte:</strong> Se o firmware do seu <span translate="no">QMX</span> for antigo, atualize-o. Se você estiver usando um <span translate="no">QDX</span>, não há solução para isso.
            </p>""",
        'p2': """            <h4>4. O SWR é baixo durante a sintonia, mas a proteção SWR é ativada</h4>
            <p>
                Parece que o SWR apresenta picos ou atinge níveis altos por alguns instantes durante a transmissão real, o que aciona a proteção SWR. Este é um indicador de uma antena instável (ex: antenas loop magnéticas), um cabo ruim, uma má conexão ou um problema na configuração.
            </p>"""
    },
    'pt-br': {
        'p1': """            <h4>2. O firmware não suporta medição de potência</h4>
            <p>
                Se o <span translate="no">QMX</span> não mostrar que a proteção <span translate="no">SWR</span> está ativada, e mostrar que a transmissão está ocorrendo corretamente, pode ser que o firmware seja antigo e não suporte a medição de potência. Dispositivos como o <span translate="no">QDX</span> também não suportam a medição de potência. O <span translate="no">qFT8</span> não sabe como interpretar 0<span translate="no">W</span> e fica confuso.
            </p>
            <p>
                <strong>Tente o seguinte:</strong> Se o firmware do seu <span translate="no">QMX</span> for antigo, atualize-o. Se você estiver usando um <span translate="no">QDX</span>, não há solução para isso.
            </p>""",
        'p2': """            <h4>4. O SWR é baixo durante a sintonia, mas a proteção SWR é ativada</h4>
            <p>
                Parece que o SWR apresenta picos ou atinge níveis altos por alguns instantes durante a transmissão real, o que aciona a proteção SWR. Este é um indicador de uma antena instável (ex. magloops), um cabo ruim, uma conexão ruim ou um problema na configuração.
            </p>"""
    },
    'ru': {
        'p1': """            <h4>2. Прошивка не поддерживает измерение мощности</h4>
            <p>
                Если <span translate="no">QMX</span> не показывает, что защита <span translate="no">SWR</span> включена, и показывает, что передача происходит нормально, возможно, прошивка устарела и не поддерживает измерение мощности. Устройства вроде <span translate="no">QDX</span> также не поддерживают измерение мощности. <span translate="no">qFT8</span> не знает, как интерпретировать 0<span translate="no">W</span>, и возникает сбой.
            </p>
            <p>
                <strong>Попробуйте:</strong> Если прошивка вашего <span translate="no">QMX</span> устарела, обновите её. Если вы используете <span translate="no">QDX</span>, это ограничение нельзя обойти.
            </p>""",
        'p2': """            <h4>4. КСВ низкий при настройке, но срабатывает защита SWR</h4>
            <p>
                Похоже, что КСВ (SWR) резко возрастает или достигает пиковых значений на высокой мощности на несколько мгновений во время фактической передачи, что вызывает срабатывание защиты SWR. Это является признаком капризной антенны (например, магнитных рамок), плохого кабеля, плохого соединения или проблемы в настройке.
            </p>"""
    },
    'zh': {
        'p1': """            <h4>2. 固件不支持功率测量</h4>
            <p>
                如果 <span translate="no">QMX</span> 没有显示 <span translate="no">SWR</span> 保护已激活，并且显示发射正常进行，那么可能是固件太旧，不支持功率测量。像 <span translate="no">QDX</span> 这样的设备也不支持功率测量。<span translate="no">qFT8</span> 不知道如何解释 0<span translate="no">W</span>，因此会产生混淆。
            </p>
            <p>
                <strong>尝试：</strong> 如果您的 <span translate="no">QMX</span> 固件太旧，请更新它。如果您使用的是 <span translate="no">QDX</span>，则无法解决此问题。
            </p>""",
        'p2': """            <h4>4. 调谐器期间 SWR 较低，但 SWR 保护被触发</h4>
            <p>
                这似乎是因为 SWR 在实际发射过程中的某些瞬间会在高功率下出现尖峰或峰值，从而触发 SWR 保护。这表明天线挑剔（如磁环天线）、电缆损坏、连接不良或设置存在问题。
            </p>"""
    },
    'ja': {
        'p1': """            <h4>2. ファームウェアが電力測定をサポートしていない</h4>
            <p>
                <span translate="no">QMX</span> が <span translate="no">SWR</span> 保護の作動を表示しておらず、送信が正常に行われていることを示している場合、ファームウェアが古く電力測定をサポートしていない可能性があります。<span translate="no">QDX</span> のようなデバイスも電力測定をサポートしていません。<span translate="no">qFT8</span> は 0<span translate="no">W</span> をどう解釈してよいかわからず、混乱してしまいます。
            </p>
            <p>
                <strong>試してみる：</strong> <span translate="no">QMX</span> のファームウェアが古い場合は更新してください。<span translate="no">QDX</span> を使用している場合、この問題を回避する方法はありません。
            </p>""",
        'p2': """            <h4>4. チューニング中のSWRは低いが、SWR保護が作動する</h4>
            <p>
                実際の送信中に、高電力で短時間SWRが急上昇したりピークに達したりするため、SWR保護が作動しているようです。これは、不安定なアンテナ（マグネチックループなど）、不良ケーブル、接続不良、または設定の兆候です。
            </p>"""
    }
}

for lang, data in translations.items():
    path = f"/home/antigravity-user/anti/qmxandroid/qFT8/docs/manual/{lang}/index.html"
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = content.replace(eng_p1, data['p1'])
        content = content.replace(eng_p2, data['p2'])
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {lang}")
    except Exception as e:
        print(f"Error updating {lang}: {e}")

