import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Brain, Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const passwordRequirements = [
  { label: 'At least 8 characters', test: (pwd: string) => pwd.length >= 8 },
  { label: 'Contains uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
  { label: 'Contains lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
  { label: 'Contains number', test: (pwd: string) => /\d/.test(pwd) },
  { label: 'Contains special character', test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) },
];

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const failedRequirements = passwordRequirements.filter((req) => !req.test(formData.password));
      if (failedRequirements.length > 0) {
        newErrors.password = 'Password does not meet all requirements';
      }
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      toast.success('Account created!', {
        description: 'Welcome to Digital Twin. Your account has been successfully created.',
      });
      navigate('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed. Please try again.';
      toast.error('Registration failed', {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Brain className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-2xl leading-tight">Digital Twin</h1>
              <p className="text-sm text-muted-foreground">AI-Powered Assistant</p>
            </div>
          </div>
        </div>

        <Card className="border shadow-xl shadow-black/5">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
            <CardDescription className="text-center">
              Enter your information to get started
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>

                {/* Password Strength Meter */}
                {formData.password.length > 0 && (() => {
                  const passed = passwordRequirements.filter((r) => r.test(formData.password)).length;
                  const barColors = ['bg-destructive', 'bg-destructive', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
                  const textColors = ['text-destructive', 'text-destructive', 'text-yellow-600', 'text-blue-600', 'text-green-600'];
                  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
                  return (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              'h-1.5 flex-1 rounded-full transition-all',
                              i < passed ? barColors[passed - 1] : 'bg-muted'
                            )}
                          />
                        ))}
                      </div>
                      <p className={cn('text-xs font-medium', textColors[passed - 1])}>
                        {strengthLabels[passed - 1] || ''}
                      </p>
                    </div>
                  );
                })()}

                {/* Password Requirements */}
                <div className="space-y-1 mt-2">
                  {passwordRequirements.map((req, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center gap-2 text-xs transition-colors',
                        req.test(formData.password) ? 'text-success' : 'text-muted-foreground'
                      )}
                    >
                      {req.test(formData.password) ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <X className="w-3 h-3" />
                      )}
                      {req.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="agreeTerms"
                  checked={formData.agreeTerms}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, agreeTerms: checked as boolean }))
                  }
                  className={errors.agreeTerms ? 'border-destructive' : ''}
                />
                <Label htmlFor="agreeTerms" className="text-sm font-normal leading-tight cursor-pointer">
                  I agree that my data will be stored securely and used only for this application
                </Label>
              </div>
              {errors.agreeTerms && (
                <p className="text-sm text-destructive">{errors.agreeTerms}</p>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full btn-animate" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Register;
