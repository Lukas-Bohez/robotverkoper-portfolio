// Delivery robot: demo launcher of Lukas.
// One exe that starts Lukas's part and nothing of anyone else's: the platform simulator (it plays the
// platform of the companies with made-up data), the seller API with its own database, the PWA of the
// seller and the Windows version of the robot simulator. No Docker, no MongoDB, no other PWA.
// Closing the window stops everything.
//
// Build: powershell -ExecutionPolicy Bypass -File build.ps1   (C# 5, the compiler that ships with Windows)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Delivery robot demo")]
[assembly: AssemblyProduct("Delivery robot demo")]
[assembly: AssemblyVersion("2.0.0.0")]

public class Step
{
    public string Name;
    public Label Icon;
    public Label Text;
    public bool Done;
    public bool Failed;
}

public class LauncherForm : Form
{
    const int SimulatorPort = 4100; // the platform simulator
    const int ApiPort = 4200;       // the seller API
    const int WebPort = 5174;       // the PWA of the seller
    const string SimulatorHealth = "http://127.0.0.1:4100/health";
    const string ApiHealth = "http://127.0.0.1:4200/health";
    const string WebUrl = "http://localhost:5174/";

    readonly string root;
    readonly string lukas;
    readonly Dictionary<string, Step> steps = new Dictionary<string, Step>();
    readonly TextBox log = new TextBox();
    readonly List<Process> started = new List<Process>();
    readonly object gate = new object();
    Process stack;       // npm start in Lukas/: platform simulator, seller API and seller PWA
    Process simulator;   // bot.exe
    volatile bool closing;
    bool opened;

    readonly Label headline = new Label();
    readonly Label hint = new Label();
    readonly ProgressBar bar = new ProgressBar();
    readonly Button openButton = new Button();
    readonly Button detailsButton = new Button();
    readonly Label accounts = new Label();
    readonly Button stopButton = new Button();
    bool showDetails;

    public LauncherForm(string root)
    {
        this.root = root;
        this.lukas = Path.Combine(root, "Lukas");
        Text = "Delivery robot: demo";
        ClientSize = new Size(520, 420);
        MinimumSize = new Size(540, 460);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 10f);
        BackColor = Color.White;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

        headline.Font = new Font("Segoe UI Semibold", 20f);
        headline.Left = 24; headline.Top = 18; headline.Width = 470; headline.Height = 40;
        headline.Text = "Even geduld…";
        Controls.Add(headline);

        hint.ForeColor = Color.DimGray;
        hint.Left = 26; hint.Top = 60; hint.Width = 470; hint.Height = 22;
        hint.Text = "De demo wordt klaargezet. Dit duurt de eerste keer wat langer.";
        Controls.Add(hint);

        bar.Style = ProgressBarStyle.Marquee;
        bar.MarqueeAnimationSpeed = 30;
        bar.Left = 26; bar.Top = 90; bar.Width = 468; bar.Height = 8;
        Controls.Add(bar);

        string[][] defs = {
            new[] { "platform", "Platform-simulator" },
            new[] { "api", "Verkopers-API en database" },
            new[] { "web", "Website van de verkoper" },
            new[] { "simulator", "Robot-app" },
        };
        int y = 116;
        foreach (string[] def in defs)
        {
            var icon = new Label { Text = "○", Left = 28, Top = y, Width = 24, Height = 24, ForeColor = Color.Gray, Font = new Font("Segoe UI Symbol", 12f) };
            var text = new Label { Text = def[1], Left = 56, Top = y + 1, Width = 440, Height = 24 };
            Controls.Add(icon);
            Controls.Add(text);
            steps[def[0]] = new Step { Name = def[1], Icon = icon, Text = text };
            y += 30;
        }

        openButton.Text = "Open de website";
        openButton.Font = new Font("Segoe UI Semibold", 12f);
        openButton.Left = 26; openButton.Top = y + 14; openButton.Width = 468; openButton.Height = 46;
        openButton.BackColor = Color.FromArgb(22, 163, 74);
        openButton.ForeColor = Color.White;
        openButton.FlatStyle = FlatStyle.Flat;
        openButton.FlatAppearance.BorderSize = 0;
        openButton.Enabled = false;
        openButton.Click += delegate { Open(WebUrl); };
        Controls.Add(openButton);

        accounts.Text = FirebaseConfigured()
            ? "Inloggen met  docent@howest.be  en je eigen wachtwoord"
            : "Lokale demo: inloggen met  docent@howest.be  (elk wachtwoord)";
        accounts.ForeColor = Color.DimGray;
        accounts.Left = 26; accounts.Top = y + 70; accounts.Width = 468; accounts.Height = 22;
        Controls.Add(accounts);

        stopButton.Text = "Alles stoppen";
        stopButton.Left = 26; stopButton.Top = y + 104; stopButton.Width = 150; stopButton.Height = 32;
        stopButton.Click += delegate { Close(); };
        Controls.Add(stopButton);

        detailsButton.Text = "Toon details";
        detailsButton.Left = 184; detailsButton.Top = y + 104; detailsButton.Width = 130; detailsButton.Height = 32;
        detailsButton.Click += delegate { ToggleDetails(); };
        Controls.Add(detailsButton);

        var simButton = new Button { Text = "Robot-app tonen", Left = 322, Top = y + 104, Width = 172, Height = 32 };
        simButton.Click += delegate { ShowSimulator(); };
        Controls.Add(simButton);

        // The technical log is hidden until you ask for it
        log.Multiline = true;
        log.ReadOnly = true;
        log.ScrollBars = ScrollBars.Vertical;
        log.Font = new Font("Consolas", 9f);
        log.BackColor = Color.FromArgb(30, 32, 38);
        log.ForeColor = Color.Gainsboro;
        log.Left = 26; log.Top = y + 150; log.Width = 468; log.Height = 190;
        log.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right | AnchorStyles.Bottom;
        log.Visible = false;
        Controls.Add(log);

        ClientSize = new Size(520, y + 150);
        MinimumSize = Size;

        try { File.WriteAllText(LogFile, ""); } catch { }
        Shown += delegate { var t = new Thread(Run); t.IsBackground = true; t.Start(); };
        FormClosing += OnClosing;
    }

    /// With the Firebase values of Lukas/seller-pwa/.env the real logins are used, else local demo logins
    bool FirebaseConfigured()
    {
        try
        {
            string env = Path.Combine(lukas, "seller-pwa", ".env");
            if (!File.Exists(env)) return false;
            bool project = false, key = false;
            foreach (string line in File.ReadAllLines(env))
            {
                string t = line.Trim();
                if (t.StartsWith("VITE_FIREBASE_projectId=") && t.Length > "VITE_FIREBASE_projectId=".Length) project = true;
                if (t.StartsWith("VITE_FIREBASE_apiKey=") && t.Length > "VITE_FIREBASE_apiKey=".Length) key = true;
            }
            return project && key;
        }
        catch { return false; }
    }

    void ToggleDetails()
    {
        showDetails = !showDetails;
        log.Visible = showDetails;
        detailsButton.Text = showDetails ? "Verberg details" : "Toon details";
        int baseHeight = log.Top - 4;
        ClientSize = new Size(ClientSize.Width, showDetails ? baseHeight + 210 : baseHeight);
    }

    /// <summary>One plain sentence about how it is going</summary>
    void UpdateHeadline()
    {
        bool failed = steps.Values.Any(s => s.Failed);
        bool allOk = steps.Values.All(s => s.Done);
        if (failed)
        {
            headline.Text = "Er ging iets mis";
            headline.ForeColor = Color.Firebrick;
            hint.Text = "De details hieronder zeggen wat. Sluit het venster en probeer opnieuw.";
            bar.Style = ProgressBarStyle.Continuous;
            bar.Value = 0;
            if (!showDetails) ToggleDetails();
        }
        else if (allOk)
        {
            headline.Text = "Alles draait";
            headline.ForeColor = Color.SeaGreen;
            hint.Text = "Klik op de groene knop. Sluit dit venster om alles te stoppen.";
            bar.Style = ProgressBarStyle.Continuous;
            bar.Value = 100;
        }
        else
        {
            headline.Text = "Even geduld…";
            headline.ForeColor = Color.Black;
        }
        openButton.Enabled = steps["web"].Done;
        openButton.BackColor = openButton.Enabled ? Color.FromArgb(22, 163, 74) : Color.FromArgb(225, 228, 232);
        openButton.ForeColor = openButton.Enabled ? Color.White : Color.Gray;
    }

    // ---------- ui helpers (thread-safe) ----------

    void Ui(Action action)
    {
        if (IsDisposed || closing) return;
        try { BeginInvoke(action); } catch { }
    }

    // The log is also kept in a file, for when the window is gone
    static readonly string LogFile = Path.Combine(Path.GetTempPath(), "delivery-robot-demo.log");

    void Log(string line)
    {
        try { lock (gate) File.AppendAllText(LogFile, DateTime.Now.ToString("HH:mm:ss") + "  " + line + "\r\n", Encoding.UTF8); } catch { }
        Ui(delegate
        {
            log.AppendText(line + "\r\n");
            if (log.Lines.Length > 600) log.Lines = log.Lines.Skip(log.Lines.Length - 400).ToArray();
        });
    }

    void SetStep(string key, string state, string detail)
    {
        Ui(delegate
        {
            Step step = steps[key];
            step.Done = state == "ok";
            step.Failed = state == "fail";
            step.Icon.Text = state == "ok" ? "✔" : state == "busy" ? "◔" : state == "fail" ? "✖" : "○";
            step.Icon.ForeColor = state == "ok" ? Color.SeaGreen : state == "busy" ? Color.DarkOrange : state == "fail" ? Color.Firebrick : Color.Gray;
            step.Text.Text = step.Name + (string.IsNullOrEmpty(detail) ? "" : "   " + detail);
            UpdateHeadline();
        });
    }

    static void Open(string url)
    {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
    }

    // ---------- the run ----------

    void Run()
    {
        try
        {
            if (!NodeReady()) return;
            if (!File.Exists(Path.Combine(lukas, "package.json")))
            {
                Log("De map Lukas ontbreekt of is onvolledig: " + lukas);
                SetStep("api", "fail", "map Lukas ontbreekt");
                return;
            }

            StopLeftovers();
            StartSimulatorInBackground();
            if (!EnsurePortFree(SimulatorPort, "platform") || !EnsurePortFree(ApiPort, "api") || !EnsurePortFree(WebPort, "web")) return;
            if (!EnsureDependencies()) return;
            StartStack();

            WaitUrl("platform", SimulatorHealth, 120, "http://localhost:4100");
            WaitUrl("api", ApiHealth, 120, "http://localhost:4200");
            WaitUrl("web", WebUrl, 240, "http://localhost:5174");
            if (!opened && steps["web"].Done) { opened = true; Open(WebUrl); }
        }
        catch (Exception e)
        {
            Log("Fout: " + e.Message);
        }
    }

    /// Node.js 22.18 or newer (the servers run TypeScript directly and use the built-in SQLite)
    bool NodeReady()
    {
        string version = RunQuiet("node", "--version").Trim();
        if (version.StartsWith("v"))
        {
            string[] parts = version.Substring(1).Split('.');
            int major, minor;
            if (parts.Length >= 2 && int.TryParse(parts[0], out major) && int.TryParse(parts[1], out minor))
            {
                if ((major == 22 && minor >= 18) || (major == 24 && minor >= 12) || major > 24) { Log("Node.js " + version); return true; }
            }
        }
        SetStep("api", "fail", version.Length == 0 ? "Node.js is niet geïnstalleerd" : "Node.js " + version + " is te oud");
        Log("Deze demo vraagt Node.js 22.18, of 24.12 en nieuwer. Installeer het via https://nodejs.org en start opnieuw.");
        return false;
    }

    // ---------- before the start: leftovers, ports, packages ----------

    // What this launcher started, so the next one can stop it when this one was killed or crashed
    static readonly string PidFile = Path.Combine(Path.GetTempPath(), "delivery-robot-demo.pids");

    void Remember(Process p)
    {
        lock (gate)
        {
            started.Add(p);
            try { File.AppendAllText(PidFile, p.Id + " " + p.StartTime.ToFileTimeUtc() + "\r\n"); } catch { }
        }
    }

    // A demo that was not stopped still holds the ports
    void StopLeftovers()
    {
        string[] lines;
        try { lines = File.ReadAllLines(PidFile); } catch { return; }
        foreach (string line in lines)
        {
            string[] parts = line.Split(' ');
            int pid;
            long startTime;
            if (parts.Length != 2 || !int.TryParse(parts[0], out pid) || !long.TryParse(parts[1], out startTime)) continue;
            try
            {
                Process p = Process.GetProcessById(pid);
                if (p.StartTime.ToFileTimeUtc() != startTime) continue; // the PID now belongs to another program
                Log("Een vorige demo draaide nog (PID " + pid + "): die wordt eerst gestopt.");
                KillTree(p);
                p.WaitForExit(5000);
            }
            catch { } // already gone
        }
        try { File.Delete(PidFile); } catch { }
    }

    // Another program on one of our ports would answer instead of the demo
    bool EnsurePortFree(int port, string key)
    {
        int pid = 0;
        for (int i = 0; i < 4 && !closing; i++) // a leftover that was just stopped needs a moment
        {
            pid = ListeningPid(port);
            if (pid == 0) return true;
            Thread.Sleep(500);
        }
        SetStep(key, "fail", "poort " + port + " is bezet");
        Log("Poort " + port + " is al in gebruik door " + PortOwner(pid) + ".");
        Log("Deze demo heeft de poorten 4100 (platform-simulator), 4200 (verkopers-API) en 5174 (website) nodig.");
        Log("Stop dat programma (draait er nog een `npm run dev` in een terminal? Ctrl+C) en start de demo opnieuw.");
        return false;
    }

    // From netstat: a listening socket has no remote port (0.0.0.0:0 or [::]:0). The state column
    // itself is translated on some Windows languages.
    static int ListeningPid(int port)
    {
        string output = RunQuiet("netstat", "-ano -p TCP") + RunQuiet("netstat", "-ano -p TCPv6");
        foreach (string line in output.Split('\n'))
        {
            string[] parts = line.Split(new[] { ' ', '\t', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            int pid;
            if (parts.Length >= 5 && parts[0] == "TCP" && parts[1].EndsWith(":" + port) && parts[2].EndsWith(":0")
                && int.TryParse(parts[parts.Length - 1], out pid) && pid > 0)
                return pid;
        }
        return 0;
    }

    static string PortOwner(int pid)
    {
        try { return Process.GetProcessById(pid).ProcessName + ".exe (PID " + pid + ")"; }
        catch { return "PID " + pid; }
    }

    static string RunQuiet(string file, string args)
    {
        try
        {
            var info = new ProcessStartInfo(file, args) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
            using (Process p = Process.Start(info))
            {
                string output = p.StandardOutput.ReadToEnd();
                p.StandardError.ReadToEnd();
                p.WaitForExit(15000);
                return output;
            }
        }
        catch { return ""; }
    }

    // `npm run setup` in Lukas/: installs the packages of the three Node parts when they are missing
    // or when a package-lock.json changed since the last start
    bool EnsureDependencies()
    {
        SetStep("api", "busy", "pakketten controleren (de eerste keer enkele minuten)…");
        Log("> npm run setup  (Lukas)");
        Process install = Spawn("cmd.exe", "/c npm run setup", lukas, "npm");
        install.WaitForExit();
        if (closing) return false;
        if (install.ExitCode != 0)
        {
            SetStep("api", "fail", "installeren mislukt, zie het logboek");
            return false;
        }
        return true;
    }

    // `npm start` in Lukas/: the platform simulator, the seller API (own SQLite database) and the seller PWA
    void StartStack()
    {
        SetStep("platform", "busy", "starten…");
        SetStep("api", "busy", "starten…");
        SetStep("web", "busy", "starten…");
        Log("> npm start  (Lukas)");
        stack = Spawn("cmd.exe", "/c npm start", lukas, "dev");
    }

    Process Spawn(string file, string args, string dir, string tag)
    {
        var info = new ProcessStartInfo(file, args)
        {
            WorkingDirectory = dir, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8,
        };
        var p = new Process { StartInfo = info, EnableRaisingEvents = true };
        DataReceivedEventHandler onLine = delegate (object s, DataReceivedEventArgs e)
        {
            if (e.Data != null) Log(StripAnsi(e.Data));
        };
        p.OutputDataReceived += onLine;
        p.ErrorDataReceived += onLine;
        p.Exited += delegate
        {
            if (closing) return;
            int code = SafeExit(p);
            Log("[" + tag + "] " + (code == 0 && tag != "dev" ? "klaar." : "is gestopt (code " + code + ")."));
            if (tag == "dev") SetStep("api", "fail", "gestopt, zie het logboek");
        };
        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        Remember(p);
        return p;
    }

    static int SafeExit(Process p) { try { return p.ExitCode; } catch { return -1; } }

    static string StripAnsi(string text)
    {
        return System.Text.RegularExpressions.Regex.Replace(text, "\u001b\\[[0-9;]*[A-Za-z]", "");
    }

    void WaitUrl(string key, string url, int seconds, string label)
    {
        SetStep(key, "busy", "wachten…");
        DateTime end = DateTime.UtcNow.AddSeconds(seconds);
        while (DateTime.UtcNow < end && !closing)
        {
            if (stack != null && stack.HasExited) { SetStep(key, "fail", "de demo is gestopt"); return; }
            if (Reachable(url)) { SetStep(key, "ok", label); return; }
            Thread.Sleep(1500);
        }
        if (!closing) SetStep(key, "fail", "reageert niet");
    }

    static bool Reachable(string url)
    {
        try
        {
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Timeout = 3000;
            using (var res = (HttpWebResponse)req.GetResponse()) return (int)res.StatusCode < 500;
        }
        catch (WebException e)
        {
            var res = e.Response as HttpWebResponse;
            return res != null && (int)res.StatusCode < 500;
        }
        catch { return false; }
    }

    // ---------- the Windows simulator ----------

    string SimulatorExe()
    {
        return Path.Combine(root, "Lukas", "simulator", "build", "windows", "x64", "runner", "Release", "bot.exe");
    }

    string FindFlutter()
    {
        string home = Environment.GetEnvironmentVariable("FLUTTER_ROOT");
        var candidates = new List<string>();
        if (!string.IsNullOrEmpty(home)) candidates.Add(Path.Combine(home, @"bin\flutter.bat"));
        candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), @"flutter\bin\flutter.bat"));
        candidates.Add(@"C:\src\flutter\bin\flutter.bat");
        candidates.Add(@"C:\flutter\bin\flutter.bat");
        foreach (string dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';'))
            if (dir.Trim().Length > 0) candidates.Add(Path.Combine(dir.Trim(), "flutter.bat"));
        return candidates.FirstOrDefault(File.Exists);
    }

    /// The exe is older than the code of the app: it would show an old version
    bool SimulatorIsOutdated()
    {
        try
        {
            if (!File.Exists(SimulatorExe())) return true;
            // bot.exe is only a stub that is not rewritten by a rebuild: the app itself is datapp.so
            string app = Path.Combine(Path.GetDirectoryName(SimulatorExe()), "data", "app.so");
            DateTime built = File.GetLastWriteTimeUtc(File.Exists(app) ? app : SimulatorExe());
            string lib = Path.Combine(root, "Lukas", "simulator", "lib");
            foreach (string f in Directory.GetFiles(lib, "*", SearchOption.AllDirectories))
                if (File.GetLastWriteTimeUtc(f) > built) return true;
            return false;
        }
        catch { return false; }
    }

    /// build/windows was made in another folder (the repo was moved or copied): CMake refuses to
    /// build there again ("does not match the source ... used to generate cache"). It only holds
    /// generated files, so it can go.
    bool BuildFolderFromOtherPlace()
    {
        try
        {
            string cache = Path.Combine(root, "Lukas", "simulator", "build", "windows", "x64", "CMakeCache.txt");
            if (!File.Exists(cache)) return false;
            const string key = "CMAKE_HOME_DIRECTORY:INTERNAL=";
            string line = File.ReadLines(cache).FirstOrDefault(l => l.StartsWith(key));
            if (line == null) return false;
            string madeFor = Path.GetFullPath(line.Substring(key.Length).Trim());
            string here = Path.GetFullPath(Path.Combine(root, "Lukas", "simulator", "windows"));
            return !string.Equals(madeFor.TrimEnd('\\'), here.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase);
        }
        catch { return false; }
    }

    void StartSimulatorInBackground()
    {
        var t = new Thread(delegate ()
        {
            try
            {
                if (BuildFolderFromOtherPlace())
                {
                    Log("Simulator: build/windows komt van een andere map (repo verplaatst?), wordt opnieuw gebouwd.");
                    Directory.Delete(Path.Combine(root, "Lukas", "simulator", "build", "windows"), true);
                }
                if (!File.Exists(SimulatorExe()) || SimulatorIsOutdated())
                {
                    string flutter = FindFlutter();
                    if (flutter == null)
                    {
                        SetStep("simulator", "fail", "nog niet gebouwd en Flutter niet gevonden");
                        Log("Simulator: bouw hem eerst met `flutter build windows` in Lukas/simulator (Flutter + Visual Studio nodig).");
                        return;
                    }
                    SetStep("simulator", "busy", "bouwen (enkele minuten)…");
                    Log("> flutter build windows  (Lukas/simulator)");
                    Process build = Spawn("cmd.exe", "/c \"\"" + flutter + "\" build windows\"", Path.Combine(root, "Lukas", "simulator"), "flutter");
                    build.WaitForExit();
                    // The old bot.exe is still there after a failed build: never start it, it shows an old version of the app
                    if (SafeExit(build) != 0 || !File.Exists(SimulatorExe())) { SetStep("simulator", "fail", "bouwen mislukt, zie het logboek"); return; }
                }
                simulator = Process.Start(new ProcessStartInfo(SimulatorExe()) { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(SimulatorExe()) });
                Remember(simulator);
                SetStep("simulator", "ok", "draait");
                Log("Simulator gestart: kies Platform. De sleutel van een nieuwe robot uit de website verschijnt daar vanzelf.");
            }
            catch (Exception e) { SetStep("simulator", "fail", e.Message); }
        });
        t.IsBackground = true;
        t.Start();
    }

    void ShowSimulator()
    {
        if (simulator != null && !simulator.HasExited) { try { simulator.Refresh(); } catch { } return; }
        StartSimulatorInBackground();
    }

    // ---------- stopping ----------

    void OnClosing(object sender, FormClosingEventArgs e)
    {
        if (closing) return;
        closing = true;
        Text = "Delivery robot: demo (stoppen…)";
        Cursor = Cursors.WaitCursor;
        Application.DoEvents();
        StopAll();
    }

    void StopAll()
    {
        List<Process> all;
        lock (gate) all = new List<Process>(started);
        foreach (Process p in all) KillTree(p);
        try { File.Delete(PidFile); } catch { }
    }

    static void KillTree(Process p)
    {
        try
        {
            if (p == null || p.HasExited) return;
            var info = new ProcessStartInfo("taskkill", "/PID " + p.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
            using (Process k = Process.Start(info)) { k.WaitForExit(10000); }
        }
        catch { }
    }
}

public static class Program
{
    [STAThread]
    public static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        string root = FindRoot(args);
        if (root == null)
        {
            MessageBox.Show("De map van de repo is niet gevonden.\n\nZet deze exe in de repo (Lukas\\demo-launcher) of geef de map mee:\nDelivery Robot Demo.exe \"C:\\pad\\naar\\26-ratty-raccoon\"", "Delivery robot: demo");
            return;
        }

        // One launcher at a time: a second one would fight over the ports
        bool created;
        using (var mutex = new Mutex(true, "DeliveryRobotDemoLauncher", out created))
        {
            if (!created)
            {
                MessageBox.Show("De demo draait al. Sluit eerst het andere launcher-venster.", "Delivery robot: demo");
                return;
            }
            Application.Run(new LauncherForm(root));
        }
    }

    // The repo root: the folder that holds Lukas\simulator
    static string FindRoot(string[] args)
    {
        var starts = new List<string>();
        if (args.Length > 0) starts.Add(args[0]);
        starts.Add(AppDomain.CurrentDomain.BaseDirectory);
        starts.Add(Environment.CurrentDirectory);
        foreach (string start in starts)
        {
            try
            {
                var dir = new DirectoryInfo(Path.GetFullPath(start));
                while (dir != null)
                {
                    if (Directory.Exists(Path.Combine(dir.FullName, "Lukas", "simulator")))
                        return dir.FullName;
                    dir = dir.Parent;
                }
            }
            catch { }
        }
        return null;
    }
}
