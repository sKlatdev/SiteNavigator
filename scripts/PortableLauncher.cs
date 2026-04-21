using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

internal static class Program
{
    private const string CoreResourceName = "SiteNavigator.Core.exe";
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectExtendedLimitInformation = 9;

    private static volatile bool _restarting = false;
    private static int _port = 8787;

    [STAThread]
    private static int Main()
    {
        string launcherPath = Assembly.GetExecutingAssembly().Location;
        string launcherDir = Path.GetDirectoryName(launcherPath) ?? AppDomain.CurrentDomain.BaseDirectory;
        string runtimeRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SiteNavigator",
            "runtime"
        );

        Directory.CreateDirectory(runtimeRoot);

        byte[] payload = ReadEmbeddedCorePayload();
        string payloadHash = ComputeSha256Hex(payload);
        string runtimeDir = Path.Combine(runtimeRoot, payloadHash);
        string coreExePath = Path.Combine(runtimeDir, "sitenavigator-core.exe");
        Directory.CreateDirectory(runtimeDir);

        if (!File.Exists(coreExePath) || !FileContentMatches(coreExePath, payload))
        {
            File.WriteAllBytes(coreExePath, payload);
        }

        ProcessStartInfo startInfo = BuildStartInfo(coreExePath, launcherDir);

        using (Process child = Process.Start(startInfo))
        {
            if (child == null)
            {
                throw new InvalidOperationException("Failed to start packaged runtime.");
            }

            using (SafeJobHandle jobHandle = CreateKillOnCloseJob())
            {
                if (!AssignProcessToJobObject(jobHandle.DangerousGetHandle(), child.Handle))
                {
                    throw new InvalidOperationException("Failed to bind packaged runtime to process job.");
                }

                child.WaitForExit();
                return child.ExitCode;
            }
        }
    }

    private static Process SpawnChild(string coreExePath, string launcherDir)
    {
        ProcessStartInfo startInfo = BuildStartInfo(coreExePath, launcherDir);

        Process child = Process.Start(startInfo);
        if (child == null)
        {
            throw new InvalidOperationException("Failed to start packaged runtime.");
        }
        return child;
    }

    private static ProcessStartInfo BuildStartInfo(string coreExePath, string launcherDir)
    {
        ProcessStartInfo startInfo = new ProcessStartInfo();
        startInfo.FileName = coreExePath;
        startInfo.WorkingDirectory = launcherDir;
        startInfo.UseShellExecute = false;
        startInfo.CreateNoWindow = true;
        startInfo.WindowStyle = ProcessWindowStyle.Hidden;

        string configuredDataDir = Environment.GetEnvironmentVariable("SITENAVIGATOR_DATA_DIR");
        startInfo.EnvironmentVariables["SITENAVIGATOR_DATA_DIR"] =
            string.IsNullOrWhiteSpace(configuredDataDir)
                ? Path.Combine(launcherDir, "data")
                : configuredDataDir;

        CopyEnvironmentVariable(startInfo, "PORT");
        CopyEnvironmentVariable(startInfo, "PORT_RETRY_COUNT");
        CopyEnvironmentVariable(startInfo, "ALLOWED_ORIGINS");
        CopyEnvironmentVariable(startInfo, "ENABLE_PATH_IMPORT");
        CopyEnvironmentVariable(startInfo, "ENABLE_INDEX_PATH_IO");
        CopyEnvironmentVariable(startInfo, "CONTENT_CACHE_MAX_AGE");
        CopyEnvironmentVariable(startInfo, "SLOW_ROUTE_MS");

        string openBrowser = Environment.GetEnvironmentVariable("SITENAVIGATOR_OPEN_BROWSER");
        startInfo.EnvironmentVariables["SITENAVIGATOR_OPEN_BROWSER"] =
            string.IsNullOrWhiteSpace(openBrowser) ? "true" : openBrowser;

        return startInfo;
    }

    private static void KillChild(Process child)
    {
        if (child == null) return;
        try
        {
            if (!child.HasExited)
            {
                child.Kill();
            }
            child.WaitForExit(3000);
        }
        catch (InvalidOperationException)
        {
            // Process already exited — nothing to do.
        }
    }

    private static NotifyIcon CreateTrayIcon(
        int port,
        string coreExePath,
        string launcherDir,
        SafeJobHandle jobHandle,
        Process[] childCell,
        System.Threading.SynchronizationContext uiContext)
    {
        // Build a 16x16 teal icon with a white "S" glyph.
        Icon icon;
        using (Bitmap bmp = new Bitmap(16, 16))
        {
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.FromArgb(0x1a, 0x6b, 0x6b));
                using (Font font = new Font("Arial", 7f, FontStyle.Bold, GraphicsUnit.Point))
                using (SolidBrush brush = new SolidBrush(Color.White))
                {
                    SizeF size = g.MeasureString("S", font);
                    float x = (16f - size.Width) / 2f;
                    float y = (16f - size.Height) / 2f;
                    g.DrawString("S", font, brush, x, y);
                }
            }
            IntPtr hicon = bmp.GetHicon();
            icon = (Icon)Icon.FromHandle(hicon).Clone();
            DestroyIcon(hicon);
        }

        ContextMenuStrip menu = new ContextMenuStrip();
        ToolStripMenuItem openItem = new ToolStripMenuItem("Open SiteNavigator");
        ToolStripMenuItem restartItem = new ToolStripMenuItem("Restart");
        ToolStripMenuItem quitItem = new ToolStripMenuItem("Quit");

        openItem.Click += (s, e) =>
        {
            try { Process.Start("http://localhost:" + port); }
            catch { }
        };

        restartItem.Click += (s, e) =>
        {
            _restarting = true;
            try
            {
                KillChild(childCell[0]);
                childCell[0].Dispose();
                Process newChild = SpawnChild(coreExePath, launcherDir);
                newChild.EnableRaisingEvents = true;
                newChild.Exited += (ps, pe) =>
                {
                    if (_restarting) return;
                    uiContext.Post(_ => Application.Exit(), null);
                };
                if (!AssignProcessToJobObject(jobHandle.DangerousGetHandle(), newChild.Handle))
                {
                    throw new InvalidOperationException("Failed to bind restarted runtime to process job.");
                }
                childCell[0] = newChild;
            }
            finally
            {
                _restarting = false;
            }
        };

        quitItem.Click += (s, e) =>
        {
            KillChild(childCell[0]);
            Application.Exit();
        };

        menu.Items.Add(openItem);
        menu.Items.Add(restartItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(quitItem);

        NotifyIcon tray = new NotifyIcon();
        tray.Icon = icon;
        tray.Text = "SiteNavigator";
        tray.ContextMenuStrip = menu;
        tray.Visible = true;

        tray.DoubleClick += (s, e) =>
        {
            try { Process.Start("http://localhost:" + port); }
            catch { }
        };

        return tray;
    }

    private static byte[] ReadEmbeddedCorePayload()
    {
        Assembly assembly = Assembly.GetExecutingAssembly();
        using (Stream stream = assembly.GetManifestResourceStream(CoreResourceName))
        {
            if (stream == null)
            {
                throw new InvalidOperationException("Embedded packaged runtime was not found.");
            }

            using (MemoryStream memory = new MemoryStream())
            {
                stream.CopyTo(memory);
                return memory.ToArray();
            }
        }
    }

    private static bool FileContentMatches(string path, byte[] expected)
    {
        byte[] actual = File.ReadAllBytes(path);
        if (actual.Length != expected.Length)
        {
            return false;
        }

        for (int index = 0; index < actual.Length; index++)
        {
            if (actual[index] != expected[index])
            {
                return false;
            }
        }

        return true;
    }

    private static string ComputeSha256Hex(byte[] bytes)
    {
        using (SHA256 sha256 = SHA256.Create())
        {
            byte[] hash = sha256.ComputeHash(bytes);
            StringBuilder builder = new StringBuilder(hash.Length * 2);
            for (int index = 0; index < hash.Length; index++)
            {
                builder.Append(hash[index].ToString("x2"));
            }
            return builder.ToString();
        }
    }

    private static void CopyEnvironmentVariable(ProcessStartInfo startInfo, string name)
    {
        string value = Environment.GetEnvironmentVariable(name);
        if (!string.IsNullOrWhiteSpace(value))
        {
            startInfo.EnvironmentVariables[name] = value;
        }
    }

    private static SafeJobHandle CreateKillOnCloseJob()
    {
        IntPtr jobPtr = CreateJobObject(IntPtr.Zero, null);
        if (jobPtr == IntPtr.Zero)
        {
            throw new InvalidOperationException("Failed to create process job object.");
        }

        JOBOBJECT_EXTENDED_LIMIT_INFORMATION info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

        int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
        IntPtr infoPtr = Marshal.AllocHGlobal(length);
        try
        {
            Marshal.StructureToPtr(info, infoPtr, false);
            if (!SetInformationJobObject(jobPtr, JobObjectExtendedLimitInformation, infoPtr, (uint)length))
            {
                CloseHandle(jobPtr);
                throw new InvalidOperationException("Failed to configure process job object.");
            }
        }
        finally
        {
            Marshal.FreeHGlobal(infoPtr);
        }

        return new SafeJobHandle(jobPtr);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    private sealed class SafeJobHandle : IDisposable
    {
        private IntPtr _handle;

        public SafeJobHandle(IntPtr handle)
        {
            _handle = handle;
        }

        public IntPtr DangerousGetHandle()
        {
            return _handle;
        }

        public void Dispose()
        {
            if (_handle != IntPtr.Zero)
            {
                CloseHandle(_handle);
                _handle = IntPtr.Zero;
            }
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr jobAttributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetInformationJobObject(IntPtr job, int infoType, IntPtr jobObjectInfo, uint jobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DestroyIcon(IntPtr handle);
}
