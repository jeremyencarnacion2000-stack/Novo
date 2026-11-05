$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class AudioEnumerator {}
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDevices {
 [PreserveSig] int EnumAudioEndpoints(int flow,int state,out IntPtr devices);
 [PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out IDevice device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDevice {
 [PreserveSig] int Activate(ref Guid iid,uint context,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)] out object result);
}
[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ILevel {
 [PreserveSig] int RegisterControlChangeNotify(IntPtr notify);
 [PreserveSig] int UnregisterControlChangeNotify(IntPtr notify);
 [PreserveSig] int GetChannelCount(out uint count);
 [PreserveSig] int SetMasterVolumeLevel(float level,ref Guid context);
 [PreserveSig] int SetMasterVolumeLevelScalar(float level,ref Guid context);
 [PreserveSig] int GetMasterVolumeLevel(out float level);
 [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
 [PreserveSig] int SetChannelVolumeLevel(uint channel,float level,ref Guid context);
 [PreserveSig] int SetChannelVolumeLevelScalar(uint channel,float level,ref Guid context);
 [PreserveSig] int GetChannelVolumeLevel(uint channel,out float level);
 [PreserveSig] int GetChannelVolumeLevelScalar(uint channel,out float level);
 [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool muted,ref Guid context);
 [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool muted);
}
public static class MicrophoneLevel {
 public static object[] Read(int role) {
  var devices=(IDevices)new AudioEnumerator(); IDevice device;object raw=null;
  Marshal.ThrowExceptionForHR(devices.GetDefaultAudioEndpoint(1,role,out device));
  try {var iid=typeof(ILevel).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out raw));
   var volume=(ILevel)raw;float scalar,db;bool mute;
   Marshal.ThrowExceptionForHR(volume.GetMasterVolumeLevelScalar(out scalar));
   Marshal.ThrowExceptionForHR(volume.GetMasterVolumeLevel(out db));
   Marshal.ThrowExceptionForHR(volume.GetMute(out mute));
   return new object[]{Math.Round(scalar*100,1),db,mute};
  } finally {if(raw!=null)Marshal.ReleaseComObject(raw);Marshal.ReleaseComObject(device);Marshal.ReleaseComObject(devices);}
 }
}
'@
foreach($role in 0,1,2){$r=[MicrophoneLevel]::Read($role);[pscustomobject]@{role=$role;percent=$r[0];decibels=$r[1];muted=$r[2]} | ConvertTo-Json -Compress}
