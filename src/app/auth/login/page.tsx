'use client';
import axios from 'axios';
import React, { use, useState } from 'react';

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    //m
    const handleAuthMe= async () => {
        const response = await axios.get('http://localhost:8000/auth/me', {
            headers: {
                "Content-Type": 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`
            },
        });
    console.log("Auth Me Response:", response.data);
     if (response.status === 200) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
            console.log("User Info successful", response.data);
        }else{
            console.error("User failed",response.data.message);
        }
    }

    //DESDE AQUI FUE PARA EL LOGIN YA ESTA 
    const handleLogin = async (e:any) => {
        e.preventDefault();
        const response = await axios.post('http://localhost:8000/auth/login', {
            username,
            password,
        },{
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.status === 200) {
            localStorage.setItem('token', response.data.token);
            console.log("Login successful", response.data);
            await handleAuthMe(); // Call to fetch user info after login
        }else{
            console.error("Login failed",response.data.message);
        }
    }
    return (
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
            <h1 className="text-2xl font-bold">Login</h1>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
                type="text"
                placeholder="Username"
                className="border border-gray-300 p-2 rounded"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <input
                type="password"
                placeholder="Password"
                className="border border-gray-300 p-2 rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button
                type="submit"
                className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
            >
                Login
            </button>
        </form>
        </main>
    </div>
    );
}