// src/components/Settings/Security/TwoFactorAuth.tsx
import React, { useState, useEffect } from "react";
import {
  Smartphone,
  Shield,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../services/supabaseClient";
import { auditService } from "../../../services/auditService";
import { Factor } from "@supabase/supabase-js";
import QRCode from "qrcode";

export const TwoFactorAuth: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [showDisableMFADialog, setShowDisableMFADialog] = useState(false);
  const [disableMfaCode, setDisableMfaCode] = useState("");
  const [disableMfaLoading, setDisableMfaLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadMFAFactors();
    }
  }, [user]);

  const loadMFAFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      // Handle both old and new API response formats
      const factorsList = data?.all || data?.totp || [];
      setFactors(factorsList);
    } catch (err: any) {
      console.error("Error loading MFA factors:", err);
    }
  };

  const startEnrollment = async () => {
  setLoading(true);
  setError("");

  try {
    // Check for existing unverified factors first
    const { data: existingFactors } = await supabase.auth.mfa.listFactors();
    const unverifiedFactor = existingFactors?.all?.find(f => f.status === "unverified");
    
    if (unverifiedFactor) {
      // Delete the existing unverified factor to avoid friendly name conflict
      await supabase.auth.mfa.unenroll({
        factorId: unverifiedFactor.id,
      });
    }

    // Now proceed with creating a new factor
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "SmartCFO App",
    });

    if (error) throw error;

    // Store the factor ID for verification
    if (data.id) {
      // Refresh factors list after enrollment
      await loadMFAFactors();
    }

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(data.totp.uri);
    setQrCode(qrCodeUrl);
    setSecret(data.totp.secret);
    setShowEnrollment(true);
  } catch (err: any) {
    setError(err.message || "Failed to start 2FA enrollment");
  } finally {
    setLoading(false);
  }
};

  const verifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // First, we need to create a challenge
      const unverifiedFactor = factors.find((f) => f.status === "unverified");
      if (!unverifiedFactor) {
        setError("No unverified factor found. Please start enrollment again.");
        setLoading(false);
        return;
      }

      // Create a challenge for the factor
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: unverifiedFactor.id,
        });

      if (challengeError) throw challengeError;

      // Now verify with the challenge ID
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: unverifiedFactor.id,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (error) throw error;

      // Generate backup codes
      const codes = generateBackupCodes();
      setBackupCodes(codes);
      setShowBackupCodes(true);

      // Save backup codes to user settings
      await supabase
        .from("user_settings")
        .update({
          mfa_backup_codes: codes.map((code) => hashBackupCode(code)),
        })
        .eq("user_id", user!.id);

      // Log the action
      await auditService.log({
        user_id: user!.id,
        action: "settings_updated",
        entity_type: "user",
        entity_id: user!.id,
        entity_name: "Two-Factor Authentication",
        changes: {
          mfa_enabled: { from: false, to: true },
        },
        metadata: {
          factor_type: "totp",
          timestamp: new Date().toISOString(),
        },
      });

      setSuccess("Two-factor authentication enabled successfully!");
      setShowEnrollment(false);
      await loadMFAFactors();
    } catch (err: any) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (
      !window.confirm(
        "Are you sure you want to disable two-factor authentication? This will make your account less secure."
      )
    ) {
      return;
    }

    // Check AAL level first
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalData?.currentLevel !== "aal2") {
      // Need to elevate to AAL2 first
      setShowDisableMFADialog(true);
      return;
    }

    // If we already have AAL2, proceed with disabling
    await performDisable2FA();
  };

  const performDisable2FA = async () => {
    setLoading(true);
    setError("");

    try {
      const factor = factors.find((f) => f.status === "verified");
      if (!factor) return;

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });

      if (error) throw error;

      // Clear backup codes
      await supabase
        .from("user_settings")
        .update({ mfa_backup_codes: null })
        .eq("user_id", user!.id);

      // Log the action
      await auditService.log({
        user_id: user!.id,
        action: "settings_updated",
        entity_type: "user",
        entity_id: user!.id,
        entity_name: "Two-Factor Authentication",
        changes: {
          mfa_enabled: { from: true, to: false },
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });

      setSuccess("Two-factor authentication disabled");
      await loadMFAFactors();
    } catch (err: any) {
      if (err.message?.includes("AAL2")) {
        setError("Please verify your identity first using the button below.");
        setShowDisableMFADialog(true);
      } else {
        setError(err.message || "Failed to disable 2FA");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFAVerification = async () => {
    if (!disableMfaCode || disableMfaCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setDisableMfaLoading(true);
    setError("");

    try {
      const verifiedFactor = factors.find((f) => f.status === "verified");
      if (!verifiedFactor) {
        setError("No verified MFA factor found");
        setDisableMfaLoading(false);
        return;
      }

      // Create challenge
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: verifiedFactor.id,
        });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: challengeData.id,
        code: disableMfaCode,
      });

      if (verifyError) throw verifyError;

      // Successfully verified - now disable 2FA
      setShowDisableMFADialog(false);
      setDisableMfaCode("");

      // Now we have AAL2, proceed with disabling
      await performDisable2FA();
    } catch (err: any) {
      setError(err.message || "Invalid MFA code");
    } finally {
      setDisableMfaLoading(false);
    }
  };

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = Array.from({ length: 8 }, () =>
        Math.random().toString(36).charAt(2).toUpperCase()
      ).join("");
      codes.push(code);
    }
    return codes;
  };

  const hashBackupCode = (code: string): string => {
    // In production, use proper hashing
    return btoa(code);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  const isEnabled = factors.some((f) => f.status === "verified");

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Two-Factor Authentication
              </h3>
              <p className="text-sm text-gray-600">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isEnabled
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {isEnabled ? "Enabled" : "Disabled"}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {!isEnabled && !showEnrollment && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Two-factor authentication adds an extra layer of security by
              requiring a code from your phone in addition to your password.
            </p>
            <button
              onClick={startEnrollment}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Smartphone className="h-5 w-5 mr-2" />
              )}
              Enable Two-Factor Authentication
            </button>
          </div>
        )}

        {isEnabled && (
          <div className="space-y-4">
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">
                Two-factor authentication is active
              </span>
            </div>
            <button
              onClick={disable2FA}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disable Two-Factor Authentication
            </button>
          </div>
        )}
      </div>

      {/* Enrollment Process */}
      {showEnrollment && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            Set up Two-Factor Authentication
          </h4>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                1. Scan this QR code with your authenticator app (Google
                Authenticator, Authy, etc.)
              </p>
              {qrCode && (
                <div className="bg-white p-4 border-2 border-gray-300 rounded-lg inline-block">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              )}

              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Can't scan? Enter this code manually:
                </p>
                <div className="flex items-center space-x-2">
                  <code className="px-3 py-2 bg-gray-100 rounded text-sm font-mono flex-1">
                    {secret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(secret)}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-4">
                2. Enter the 6-digit code from your authenticator app
              </p>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={6}
              />

              <button
                onClick={verifyAndEnable}
                disabled={loading || verificationCode.length !== 6}
                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify and Enable
              </button>

              <button
                onClick={() => {
                  setShowEnrollment(false);
                  setQrCode("");
                  setSecret("");
                  setVerificationCode("");
                }}
                className="mt-2 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Codes */}
      {showBackupCodes && backupCodes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            Save Your Backup Codes
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Store these codes in a safe place. You can use them to access your
            account if you lose your phone.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {backupCodes.map((code, index) => (
              <div
                key={index}
                className="px-3 py-2 bg-white border border-gray-300 rounded font-mono text-sm"
              >
                {code}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const codesText = backupCodes.join("\n");
              copyToClipboard(codesText);
            }}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center"
          >
            <Copy className="h-5 w-5 mr-2" />
            Copy All Codes
          </button>
        </div>
      )}

      {/* Disable MFA Verification Dialog */}
      {showDisableMFADialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Verify Your Identity
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Enter the 6-digit code from your authenticator app to disable
              two-factor authentication.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <input
              type="text"
              value={disableMfaCode}
              onChange={(e) =>
                setDisableMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              maxLength={6}
            />

            <div className="flex space-x-3">
              <button
                onClick={handleDisableMFAVerification}
                disabled={disableMfaLoading || disableMfaCode.length !== 6}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {disableMfaLoading ? "Verifying..." : "Verify and Disable 2FA"}
              </button>
              <button
                onClick={() => {
                  setShowDisableMFADialog(false);
                  setDisableMfaCode("");
                  setError("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
