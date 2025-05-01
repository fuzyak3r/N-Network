package sg.Chearstern;

import lombok.Getter;

import java.net.Socket;
import java.util.HashMap;

public class Data {

    @Getter
    private static HashMap<Socket, Handler> handlers = new HashMap<>();

    public static void add(Socket s) {
        System.out.println("pidor" + s);
        Handler handler = new Handler(s);
        new Thread(handler).start();
        getHandlers().put(s, handler);
    }

    public static void remove(Socket s) {
        getHandlers().remove(s);
    }
}
