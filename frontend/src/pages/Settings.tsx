import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { authApi, integrationsApi } from '@/services/api';
import type { GoogleIntegrationStatus, GmailSender } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  User,
  Mail,
  Moon,
  Sun,
  Bell,
  Lock,
  LogOut,
  Loader2,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Link2,
  Link2Off,
  RefreshCw,
  Calendar,
  Plus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

const NOTIF_KEY = 'notification_prefs';

interface NotifPrefs {
  email: boolean;
  push: boolean;
  weekly: boolean;
}

const defaultNotifPrefs: NotifPrefs = { email: true, push: false, weekly: true };

const Settings: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  // Integration state
  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [senders, setSenders] = useState<GmailSender[]>([]);
  const [newSender, setNewSender] = useState('');
  const [isAddingSender, setIsAddingSender] = useState(false);

  // Load notification prefs from localStorage
  const [notifications, setNotifications] = useState<NotifPrefs>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_KEY);
      return saved ? (JSON.parse(saved) as NotifPrefs) : defaultNotifPrefs;
    } catch {
      return defaultNotifPrefs;
    }
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current: '',
    newPw: '',
    confirm: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Sync profile data when user loads
  useEffect(() => {
    if (user) {
      setProfileData({ name: user.name, email: user.email });
    }
  }, [user]);

  // Persist notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications));
  }, [notifications]);

  // Load Google integration status + handle ?connected=true redirect
  useEffect(() => {
    const loadGoogleStatus = async () => {
      try {
        setIsGoogleLoading(true);
        const [status, senderList] = await Promise.all([
          integrationsApi.getGoogleStatus(),
          integrationsApi.getSenders().catch(() => [] as GmailSender[]),
        ]);
        setGoogleStatus(status);
        setSenders(senderList);
      } catch {
        // Not critical — integration may not be configured yet
        setGoogleStatus({ connected: false, email: null, connected_at: null });
      } finally {
        setIsGoogleLoading(false);
      }
    };

    loadGoogleStatus();

    // Handle OAuth redirect back with ?connected=true
    if (searchParams.get('connected') === 'true') {
      toast.success('Google account connected!', {
        description: 'You can now sync emails and calendar events.',
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleConnectGoogle = async () => {
    try {
      setIsConnecting(true);
      const authUrl = await integrationsApi.getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch {
      toast.error('Failed to start Google connection');
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      setIsDisconnecting(true);
      await integrationsApi.disconnectGoogle();
      setGoogleStatus({ connected: false, email: null, connected_at: null });
      setSenders([]);
      toast.success('Google account disconnected');
    } catch {
      toast.error('Failed to disconnect Google account');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncGmail = async () => {
    try {
      setIsSyncingGmail(true);
      const result = await integrationsApi.syncGmail();
      toast.success(`Email sync complete`, {
        description: `Created ${result.created} new task${result.created !== 1 ? 's' : ''}, skipped ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''}.`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gmail sync failed';
      toast.error(msg);
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleSyncCalendar = async () => {
    try {
      setIsSyncingCalendar(true);
      const result = await integrationsApi.syncCalendar();
      toast.success(`Calendar sync complete`, {
        description: `Synced ${result.synced} event${result.synced !== 1 ? 's' : ''} to Google Calendar.`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Calendar sync failed';
      toast.error(msg);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleAddSender = async () => {
    const email = newSender.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (senders.some((s) => s.email === email)) {
      toast.error('This sender is already in your whitelist');
      return;
    }
    try {
      setIsAddingSender(true);
      const added = await integrationsApi.addSender(email);
      setSenders((prev) => [...prev, added]);
      setNewSender('');
      toast.success('Sender added to whitelist');
    } catch {
      toast.error('Failed to add sender');
    } finally {
      setIsAddingSender(false);
    }
  };

  const handleRemoveSender = async (email: string) => {
    try {
      await integrationsApi.removeSender(email);
      setSenders((prev) => prev.filter((s) => s.email !== email));
      toast.success('Sender removed from whitelist');
    } catch {
      toast.error('Failed to remove sender');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleUpdateProfile = async () => {
    if (!profileData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      setIsUpdating(true);
      await updateUser({ name: profileData.name });
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!passwordData.current || !passwordData.newPw || !passwordData.confirm) {
      setPasswordError('All fields are required.');
      return;
    }
    if (passwordData.newPw.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordData.newPw !== passwordData.confirm) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await authApi.changePassword({
        current_password: passwordData.current,
        new_password: passwordData.newPw,
      });
      toast.success('Password updated successfully');
      setShowPasswordDialog(false);
      setPasswordData({ current: '', newPw: '', confirm: '' });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to update password. Check your current password.';
      setPasswordError(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleClosePasswordDialog = (open: boolean) => {
    if (!open) {
      setPasswordData({ current: '', newPw: '', confirm: '' });
      setPasswordError('');
    }
    setShowPasswordDialog(open);
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const handleNotifChange = (key: keyof NotifPrefs, checked: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: checked }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {user?.name ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{user?.name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpdateProfile} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-primary" />
            ) : (
              <Sun className="w-5 h-5 text-primary" />
            )}
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>Customize how Digital Twin looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark theme
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Sun className={cn('w-4 h-4', theme === 'light' && 'text-primary')} />
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
              <Moon className={cn('w-4 h-4', theme === 'dark' && 'text-primary')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Manage your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates and reminders via email
              </p>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={(checked) => handleNotifChange('email', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about task deadlines
              </p>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) => handleNotifChange('push', checked)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Summary</Label>
              <p className="text-sm text-muted-foreground">
                Receive a weekly productivity report
              </p>
            </div>
            <Switch
              checked={notifications.weekly}
              onCheckedChange={(checked) => handleNotifChange('weekly', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Change Password</Label>
              <p className="text-sm text-muted-foreground">
                Update your password regularly for security
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
              <Lock className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            <CardTitle>Integrations</CardTitle>
          </div>
          <CardDescription>Connect external services to enhance your workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Connect / Status */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                {/* Google "G" logo via SVG */}
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Google</p>
                {isGoogleLoading ? (
                  <p className="text-sm text-muted-foreground">Checking status...</p>
                ) : googleStatus?.connected ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">Connected</Badge>
                    <span className="text-sm text-muted-foreground">{googleStatus.email}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not connected</p>
                )}
              </div>
            </div>
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-2" />
            ) : googleStatus?.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectGoogle}
                disabled={isDisconnecting}
                className="border-destructive/50 text-destructive hover:bg-destructive/10 flex-shrink-0"
              >
                {isDisconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Link2Off className="w-4 h-4 mr-2" />
                    Disconnect
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnectGoogle}
                disabled={isConnecting}
                className="flex-shrink-0 btn-animate"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Sync actions — only shown when connected */}
          {googleStatus?.connected && (
            <>
              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    <h4 className="font-medium text-sm">Sync Emails</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Import emails from whitelisted senders as tasks using AI.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full btn-animate"
                    onClick={handleSyncGmail}
                    disabled={isSyncingGmail}
                  >
                    {isSyncingGmail ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync Emails Now
                      </>
                    )}
                  </Button>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h4 className="font-medium text-sm">Sync Calendar</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Push tasks with due dates to Google Calendar as events.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full btn-animate"
                    onClick={handleSyncCalendar}
                    disabled={isSyncingCalendar}
                  >
                    {isSyncingCalendar ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-2" />
                        Sync to Calendar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Sender whitelist */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Email Sender Whitelist</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only emails from these senders will be imported. Your other emails stay private.
                  </p>
                </div>

                {/* Add sender */}
                <div className="flex gap-2">
                  <Input
                    placeholder="boss@company.com"
                    value={newSender}
                    onChange={(e) => setNewSender(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSender()}
                    className="flex-1 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleAddSender}
                    disabled={isAddingSender || !newSender.trim()}
                  >
                    {isAddingSender ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Sender list */}
                {senders.length === 0 ? (
                  <div className="text-center py-4 rounded-lg border border-dashed">
                    <p className="text-sm text-muted-foreground">No senders added yet.</p>
                    <p className="text-xs text-muted-foreground">Add a sender above to start syncing emails.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {senders.map((sender) => (
                      <div
                        key={sender.email}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate">{sender.email}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={() => handleRemoveSender(sender.email)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Setup instructions when not connected */}
          {!isGoogleLoading && !googleStatus?.connected && (
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-1">
              <p className="font-medium">How it works:</p>
              <ul className="text-muted-foreground space-y-0.5 list-disc list-inside">
                <li>Connect your Google account securely via OAuth</li>
                <li>Add specific sender emails you trust to your whitelist</li>
                <li>Click "Sync Emails" to import actionable emails as tasks via AI</li>
                <li>Sync tasks with due dates to Google Calendar</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-destructive">Logout</Label>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button variant="destructive" onClick={() => setShowLogoutDialog(true)}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to logout? You'll need to login again to access your account.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={handleClosePasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {passwordError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {passwordError}
              </p>
            )}
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Enter current password"
                  className="pl-10 pr-10"
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Enter new password (min 8 chars)"
                  className="pl-10 pr-10"
                  value={passwordData.newPw}
                  onChange={(e) => setPasswordData({ ...passwordData, newPw: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10"
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClosePasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Update Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
