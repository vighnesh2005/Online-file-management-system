"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/context";
import axios from "axios";

const Signup = () => {
  const router = useRouter();
  const { setUser, setToken, setIsLoggedIn } = useAppContext();

  const [userName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      const res = await axios.post(
        "http://127.0.0.1:8000/auth/signup",
    {
        username: userName,
        email: email,
        password: password
    })

      const data = res.data;

      if (res.status !== 200) throw new Error(data.message || "Signup failed");

      // Redirect to login page after successful signup
      router.push("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-8 border border-default">
        <h1 className="text-3xl font-bold text-primary text-center mb-6">
          Create your account
        </h1>
        <form onSubmit={handleSignup} className="space-y-5">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">User Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2 border border-default rounded-lg text-white bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="User Name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-default rounded-lg text-white bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border text-white border-default rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <p className="text-error text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded-lg font-semibold transition-all duration-200 ${
              loading ? "bg-primary-hover" : "bg-primary"
            }`}
          >
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-sm text-secondary mt-4">
          Already have an account?{" "}
          <span
            className="text-primary cursor-pointer hover:underline"
            onClick={() => router.push("/login")}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
};

export default Signup;
