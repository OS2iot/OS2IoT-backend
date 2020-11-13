import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { DbBaseEntity } from "./base.entity";
import { DataTarget } from "./data-target.entity";

@Entity("open_data_dk_dataset")
export class OpenDataDkDataset extends DbBaseEntity {
    @OneToOne(type => DataTarget, dt => dt.openDataDkDataset)
    @JoinColumn()
    dataTarget: DataTarget;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column("text", { array: true })
    keywords: string[];

    @Column()
    license: string;

    @Column()
    authorName: string;

    @Column()
    authorEmail: string;

    @Column()
    resourceTitle: string;
}
