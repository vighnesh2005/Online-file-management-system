"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/context";
import axios from "axios";

const Login = () => {
  const router = useRouter();
  const { setUser, setToken, setIsLoggedIn } = useAppContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const res = await fetch("http://127.0.0.1:8000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
    });


      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Login failed");
      console.log(data);
      setToken(data.access_token);
      const user = await axios.get("http://127.0.0.1:8000/auth/me", {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
      })
      
      setUser(user.data);
      console.log(user.data);
      setIsLoggedIn(true);
      router.push("/");
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
          Welcome to G-Drive Clone
        </h1>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium  mb-1">
              Email
            </label>
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
            <label className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border text-white border-default rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <p className="text-error text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded-lg font-semibold transition-all duration-200 ${
              loading ? "bg-primary-hover" : "bg-primary"
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-center text-sm text-secondary mt-4">
          Don’t have an account?{" "}
          <span
            className="text-primary cursor-pointer hover:underline"
            onClick={() => router.push("/signup")}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;
