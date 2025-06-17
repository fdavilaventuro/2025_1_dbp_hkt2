//pantalla de autenticacion
'use client';
import axios from 'axios';
import React, { use, useState } from 'react';

export default function RegisterPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("user"); // Default role is 'user'
    //m

    //DESDE AQUI FUE PARA EL LOGIN YA ESTA 
    const handlRegister = async (e:any) => {
        e.preventDefault();
        const response = await axios.post('http://localhost:8000/auth/register', {
            username,
            password,
            role,
        },{
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (response.status === 201) {
            console.log("Register successful", response.data);
        }else{
            console.error("Register failed",response.data.message);
        }
    }
    return (
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
            <h1 className="text-2xl font-bold">Register</h1>
            <form onSubmit={handlRegister} className="flex flex-col gap-4">
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
            <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="border border-gray-300 p-2 rounded"
            >
                <option value="user">User</option>
                <option value="admin">Admin</option>
            </select>
            <button
                type="submit"
                className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
            >
                Register
            </button>
        </form>
        </main>
    </div>
    );
}