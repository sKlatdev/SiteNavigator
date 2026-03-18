using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

internal static class Program
{
    private const string CoreResourceName = "SiteNavigator.Core.exe";
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectExtendedLimitInformation = 9;

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
}
