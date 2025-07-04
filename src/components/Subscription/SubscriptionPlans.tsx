// src/components/Subscription/SubscriptionPlans.tsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Star,
  Zap,
  Rocket,
  Calendar,
  CreditCard,
  Loader2,
  AlertCircle,
  Users,
  FileText,
  Globe,
  Shield,
  Phone,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { stripeService } from "../../services/stripeService";
import { SUBSCRIPTION_PLANS, PlanType } from "../../config/subscriptionConfig";

export const SubscriptionPlans: React.FC = () => {
  const { user } = useAuth();
  const { subscription, plan: currentPlan, trialDaysLeft } = useSubscription();
  const navigate = useNavigate();

  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Set billing interval based on current subscription
    if (subscription?.interval) {
      setBillingInterval(subscription.interval);
    }
  }, [subscription]);

  const handlePlanSelection = async (planId: PlanType) => {
    if (!user?.email) {
      setError("Please complete your profile with an email address first.");
      return;
    }

    setLoading(planId);
    setError("");

    console.log("Starting plan selection:", {
      planId,
      billingInterval,
      userId: user.id,
      userEmail: user.email,
      currentSubscription: subscription,
    });

    try {
      // If user has a Stripe customer with active subscription, use portal
      if (
        subscription?.stripe_customer_id &&
        subscription?.stripe_subscription_id &&
        subscription.status === "active"
      ) {
        const { url } = await stripeService.createPortalSession(
          subscription.stripe_customer_id
        );
        window.location.href = url;
      } else {
        // Create a new checkout session
        const { url } = await stripeService.createCheckoutSession(
          planId,
          billingInterval,
          user.id,
          user.email
        );

        // Redirect to Stripe Checkout
        window.location.href = url;
      }
    } catch (err: any) {
      console.error("Error with plan selection:", err);
      // Show more detailed error information
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "Failed to process plan selection. Please try again.";
      setError(errorMessage);

      // Log full error details for debugging
      console.error("Full error details:", {
        message: err.message,
        response: err.response,
        data: err.response?.data,
      });
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!subscription?.stripe_customer_id) {
      setError("No active subscription found.");
      return;
    }

    setLoading("manage");
    setError("");

    try {
      const { url } = await stripeService.createPortalSession(
        subscription.stripe_customer_id
      );
      window.location.href = url;
    } catch (err: any) {
      console.error("Error opening customer portal:", err);
      setError("Failed to open billing portal. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const plans = Object.values(SUBSCRIPTION_PLANS);
  const currentTrialDays = trialDaysLeft();

  // Plan icons
  const getPlanIcon = (planId: PlanType) => {
    switch (planId) {
      case "simple_start":
        return Star;
      case "essentials":
        return Zap;
      case "plus":
        return Rocket;
      default:
        return Star;
    }
  };

  // Feature icons mapping
  const featureIcons: Record<string, any> = {
    "team members": Users,
    "monthly invoices": FileText,
    "Multi-currency support": Globe,
    "Custom invoice branding": Shield,
    "Phone & email support": Phone,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Settings
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Choose Your Plan
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Select the plan that best fits your business needs
            </p>
          </div>

          {currentTrialDays > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Trial Period
                  </p>
                  <p className="text-sm text-blue-700">
                    {currentTrialDays} days left
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current subscription info */}
      {subscription && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">
                Current plan:{" "}
                <span className="font-semibold text-gray-900">
                  {SUBSCRIPTION_PLANS[currentPlan]?.displayName || currentPlan}
                </span>{" "}
                ({subscription.interval === "yearly" ? "Yearly" : "Monthly"}{" "}
                billing)
              </p>
              {subscription.cancel_at_period_end && (
                <p className="text-sm text-red-600 mt-1">
                  <AlertCircle className="inline h-4 w-4 mr-1" />
                  Cancels on{" "}
                  {new Date(
                    subscription.current_period_end
                  ).toLocaleDateString()}
                </p>
              )}
              {subscription.status === "past_due" && (
                <p className="text-sm text-red-600 mt-1">
                  <AlertCircle className="inline h-4 w-4 mr-1" />
                  Payment failed - please update your payment method
                </p>
              )}
            </div>

            {subscription.stripe_customer_id &&
              subscription.status !== "canceled" && (
                <button
                  onClick={handleManageSubscription}
                  disabled={loading === "manage"}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {loading === "manage" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Manage Billing
                </button>
              )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="ml-3 text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setBillingInterval("monthly")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              billingInterval === "monthly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Monthly billing
          </button>
          <button
            onClick={() => setBillingInterval("yearly")}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              billingInterval === "yearly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Yearly billing
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const Icon = getPlanIcon(plan.id);
          const trialExpired = subscription?.trial_end
            ? new Date(subscription.trial_end) < new Date()
            : false;
          const hasPaidSubscription = !!(
            subscription?.stripe_subscription_id &&
            subscription?.status === "active"
          );
          const isCurrentPlan = !!(
            currentPlan === plan.id &&
            subscription?.interval === billingInterval &&
            hasPaidSubscription &&
            !trialExpired
          );
          const price =
            billingInterval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
          const isPopular = plan.id === "essentials";

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-xl border-2 transition-all hover:shadow-2xl ${
                isPopular
                  ? "border-blue-500 ring-2 ring-blue-500 ring-opacity-50"
                  : "border-gray-200"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-8">
                <div className="text-center mb-6">
                  <div
                    className={`inline-flex p-3 rounded-full mb-4 ${
                      isPopular
                        ? "bg-gradient-to-br from-blue-100 to-indigo-100"
                        : "bg-gray-100"
                    }`}
                  >
                    <Icon
                      className={`h-8 w-8 ${isPopular ? "text-blue-600" : "text-gray-700"}`}
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {plan.displayName}
                  </h3>
                  <p className="text-gray-600 mt-2">{plan.description}</p>

                  <div className="mt-6">
                    <div className="flex items-baseline justify-center">
                      <span className="text-5xl font-extrabold text-gray-900">
                        ${price}
                      </span>
                      <span className="text-gray-600 ml-2">
                        /{billingInterval === "yearly" ? "year" : "month"}
                      </span>
                    </div>
                    {billingInterval === "yearly" && (
                      <p className="text-sm text-green-600 mt-2">
                        Save ${plan.monthlyPrice * 12 - plan.yearlyPrice} per
                        year
                      </p>
                    )}
                  </div>
                </div>

                {/* Key limits */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Team Members</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {plan.limits.users === 1
                          ? "Just you"
                          : `Up to ${plan.limits.users}`}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Monthly Invoices</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {plan.limits.monthlyInvoices === -1
                          ? "Unlimited"
                          : plan.limits.monthlyInvoices}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top features */}
                <ul className="space-y-3 mb-8">
                  {getHighlightedFeatures(plan.id).map((feature, index) => {
                    const IconComponent = featureIcons[feature] || Check;
                    return (
                      <li key={index} className="flex items-start">
                        <IconComponent className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    );
                  })}
                </ul>

                <button
                  onClick={() => handlePlanSelection(plan.id)}
                  disabled={loading === plan.id || isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                    isCurrentPlan
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : isPopular
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                  } disabled:opacity-50`}
                >
                  {loading === plan.id ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Processing...
                    </span>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : (
                    "Choose Plan"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional info */}
      <div className="mt-12 text-center">
        <p className="text-sm text-gray-600">
          All plans include automatic backups, SSL security, and email support.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Prices are in USD. Taxes may apply based on your location.
        </p>
        <p className="text-sm text-gray-600 mt-4">
          Need help choosing?{" "}
          <a
            href="mailto:support@SmartCFO.com"
            className="text-blue-600 hover:underline"
          >
            Contact our sales team
          </a>
        </p>
      </div>
    </div>
  );
};

// Helper function to get highlighted features for each plan
function getHighlightedFeatures(plan: PlanType): string[] {
  switch (plan) {
    case "simple_start":
      return [
        "Single user access",
        "Up to 50 monthly invoices",
        "Income & expense tracking",
        "Basic financial reports",
        "Client management",
        "PDF export",
        "Email support",
      ];
    case "essentials":
      return [
        "Up to 3 team members",
        "Unlimited monthly invoices",
        "Everything in Simple Start",
        "Multi-currency support",
        "Recurring invoices",
        "Advanced reports",
        "Tax management",
        "Priority support",
      ];
    case "plus":
      return [
        "Up to 10 team members",
        "Unlimited monthly invoices",
        "Everything in Essentials",
        "Custom invoice branding",
        "Budget tracking",
        "Cash flow analysis",
        "Phone & email support",
      ];
    default:
      return [];
  }
}
